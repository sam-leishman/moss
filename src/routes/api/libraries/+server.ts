import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { validateMediaPath } from '$lib/server/security/path-validator';
import { sanitizeLibraryName } from '$lib/server/security/sanitizer';
import { ValidationError, DuplicateEntryError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Library } from '$lib/server/db';

const logger = getLogger('api:libraries');

export const GET = async () => {
	try {
		const db = getDatabase();
		const libraries = db.prepare('SELECT * FROM library ORDER BY created_at DESC').all() as Library[];
		
		return json({ libraries });
	} catch (error) {
		logger.error('Failed to fetch libraries', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const POST = async ({ request }: { request: Request }) => {
	try {
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

		logger.info(`Library created: ${sanitizedName} at ${validatedPath}`);
		
		return json({ library }, { status: 201 });
	} catch (error) {
		logger.error('Failed to create library', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
