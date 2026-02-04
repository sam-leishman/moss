import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeTagName } from '$lib/server/security/sanitizer';
import { DuplicateEntryError, ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { requireAuth, requireAdmin, getUserLibraries, isAdmin } from '$lib/server/auth';
import type { Tag } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:tags');

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const user = requireAuth(locals);
		const db = getDatabase();
		const libraryId = url.searchParams.get('library_id');
		
		let query = 'SELECT * FROM tag';
		const params: (string | number)[] = [];
		
		if (libraryId) {
			// Get library-specific tags and global tags
			query += ' WHERE (library_id = ? OR is_global = 1)';
			params.push(parseInt(libraryId, 10));
		} else if (!isAdmin(user)) {
			// Non-admin users: only show tags from their accessible libraries
			const accessibleLibraries = getUserLibraries(db, user);
			if (accessibleLibraries.length === 0) {
				return json([]);
			}
			const placeholders = accessibleLibraries.map(() => '?').join(',');
			query += ` WHERE (library_id IN (${placeholders}) OR is_global = 1)`;
			params.push(...accessibleLibraries);
		}
		
		query += ' ORDER BY is_global DESC, name ASC';
		
		const tags = db.prepare(query).all(...params) as Tag[];
		
		return json(tags);
	} catch (error) {
		logger.error('Failed to fetch tags', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = requireAdmin(locals);
		const { name, library_id, is_global } = await request.json();

		if (!name) {
			throw new ValidationError('Tag name is required');
		}

		const sanitizedName = sanitizeTagName(name);
		const isGlobal = is_global ? 1 : 0;
		const libraryId = isGlobal ? null : library_id;

		if (!isGlobal && !libraryId) {
			throw new ValidationError('Library ID is required for library-specific tags');
		}

		const db = getDatabase();
		
		// Check for duplicate: same name and library_id combination
		const existing = db.prepare(
			'SELECT id FROM tag WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL))'
		).get(sanitizedName, libraryId, libraryId);
		if (existing) {
			const scope = isGlobal ? 'global' : 'this library';
			throw new DuplicateEntryError('Tag', 'name', `${sanitizedName} (already exists in ${scope})`);
		}

		const result = db.prepare(
			'INSERT INTO tag (name, library_id, is_global) VALUES (?, ?, ?)'
		).run(sanitizedName, libraryId, isGlobal);

		const tag = db.prepare('SELECT * FROM tag WHERE id = ?').get(result.lastInsertRowid) as Tag;

		const scope = isGlobal ? 'global' : `library ${libraryId}`;
		logger.info(`Tag created by ${user.username}: ${sanitizedName} (${scope})`);
		
		return json({ tag }, { status: 201 });
	} catch (error) {
		logger.error('Failed to create tag', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
