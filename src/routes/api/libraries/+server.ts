import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { validateMediaPath } from '$lib/server/security/path-validator';
import { sanitizeLibraryName } from '$lib/server/security/sanitizer';
import { ValidationError, DuplicateEntryError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { scanLibrary } from '$lib/server/scanner/library-scanner';
import type { Library } from '$lib/server/db';
import { requireAuth, requireAdmin, filterLibrariesByAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const logger = getLogger('api:libraries');

export const GET: RequestHandler = async ({ locals }) => {
	try {
		requireAuth(locals);
		const db = getDatabase();
		const allLibraries = db.prepare('SELECT * FROM library ORDER BY created_at DESC').all() as Library[];
		
		const libraries = filterLibrariesByAccess(locals, allLibraries);
		
		return json({ libraries });
	} catch (error) {
		logger.error('Failed to fetch libraries', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = requireAdmin(locals);
		const { name, folder_path } = await request.json();

		if (!name || !folder_path) {
			throw new ValidationError('Name and folder_path are required');
		}

		const sanitizedName = sanitizeLibraryName(name);

		const validatedPath = validateMediaPath(folder_path, { mustExist: true });

		const db = getDatabase();
		
		const existingName = db.prepare('SELECT id FROM library WHERE name = ?').get(sanitizedName);
		if (existingName) {
			throw new DuplicateEntryError('Library', 'name', sanitizedName);
		}

		const existingPath = db.prepare('SELECT id FROM library WHERE folder_path = ?').get(validatedPath);
		if (existingPath) {
			throw new DuplicateEntryError('Library', 'folder_path', validatedPath);
		}

		const result = db.prepare(
			'INSERT INTO library (name, folder_path) VALUES (?, ?)'
		).run(sanitizedName, validatedPath);

		const library = db.prepare('SELECT * FROM library WHERE id = ?').get(result.lastInsertRowid) as Library;

		logger.info(`Library created by ${user.username}: ${sanitizedName} at ${validatedPath}`);
		
		// Automatically scan the library after creation
		logger.info(`Starting initial scan for library: ${library.name} (id: ${library.id})`);
		let scanStats;
		try {
			scanStats = await scanLibrary(library);
			logger.info(`Initial scan completed for library ${library.id}: ${scanStats.added} added, ${scanStats.updated} updated`);
		} catch (scanError) {
			// Log scan error but don't fail library creation
			logger.error(`Initial scan failed for library ${library.id}`, scanError instanceof Error ? scanError : undefined);
			scanStats = {
				totalScanned: 0,
				added: 0,
				updated: 0,
				removed: 0,
				thumbnailsGenerated: 0,
				filesProbed: 0,
				errors: [{ path: '', error: 'Scan failed during library creation' }],
				duration: 0
			};
		}
		
		return json({ 
			library,
			scanStats: {
				totalScanned: scanStats.totalScanned,
				added: scanStats.added,
				updated: scanStats.updated,
				removed: scanStats.removed,
				errors: scanStats.errors.length
			}
		}, { status: 201 });
	} catch (error) {
		logger.error('Failed to create library', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
