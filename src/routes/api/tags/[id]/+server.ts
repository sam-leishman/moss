import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { handleError, DuplicateEntryError, ValidationError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { sanitizeTagName } from '$lib/server/security/sanitizer';
import type { RequestHandler } from './$types';
import type { Tag } from '$lib/server/db';

const logger = getLogger('api:tags');

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const tagId = sanitizeInteger(params.id);
		const { name, is_global, library_id, force } = await request.json();

		const db = getDatabase();

		const tag = db.prepare('SELECT * FROM tag WHERE id = ?').get(tagId) as Tag | undefined;
		if (!tag) {
			error(404, 'Tag not found');
		}

		if (name !== undefined || is_global !== undefined || library_id !== undefined) {
			const sanitizedName = name ? sanitizeTagName(name) : tag.name;
			const isGlobal = is_global !== undefined ? (is_global ? 1 : 0) : tag.is_global;
			const newLibraryId = isGlobal ? null : (library_id !== undefined ? library_id : tag.library_id);

			// Validate library_id requirement early
			if (!isGlobal && !newLibraryId) {
				throw new ValidationError('Library ID is required for library-specific tags');
			}

			// Check if converting from global to library-specific
			if (tag.is_global === 1 && isGlobal === 0) {
				// Check if tag is used in other libraries (handle NULL properly)
				const otherLibraryUsage = db.prepare(`
					SELECT DISTINCT m.library_id, l.name as library_name, COUNT(*) as count
					FROM media_tag mt
					JOIN media m ON mt.media_id = m.id
					JOIN library l ON m.library_id = l.id
					WHERE mt.tag_id = ? AND (? IS NULL OR m.library_id != ?)
					GROUP BY m.library_id, l.name
				`).all(tagId, newLibraryId, newLibraryId) as Array<{ library_id: number; library_name: string; count: number }>;

				if (otherLibraryUsage.length > 0 && !force) {
					const totalItems = otherLibraryUsage.reduce((sum, lib) => sum + lib.count, 0);
					return json({
						error: 'cross_library_usage',
						message: 'This tag is currently used in other libraries',
						usage: otherLibraryUsage,
						totalItems,
						tagId
					}, { status: 409 });
				}

				// If force is true, remove tag from media in other libraries (in transaction)
				if (force) {
					const updateTransaction = db.transaction(() => {
						const deleteResult = db.prepare(`
							DELETE FROM media_tag
							WHERE tag_id = ? AND media_id IN (
								SELECT id FROM media WHERE library_id != ?
							)
						`).run(tagId, newLibraryId);

						const totalItems = otherLibraryUsage.reduce((sum, lib) => sum + lib.count, 0);
						logger.info(`Removed tag ${tagId} from ${totalItems} item(s) across ${otherLibraryUsage.length} other library/libraries (forced)`);

						// Update tag in same transaction
						const existing = db.prepare(
							'SELECT id FROM tag WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL)) AND id != ?'
						).get(sanitizedName, newLibraryId, newLibraryId, tagId);
						if (existing) {
							const scope = isGlobal ? 'global' : 'this library';
							throw new DuplicateEntryError('Tag', 'name', `${sanitizedName} (already exists in ${scope})`);
						}

						db.prepare(
							'UPDATE tag SET name = ?, library_id = ?, is_global = ? WHERE id = ?'
						).run(sanitizedName, newLibraryId, isGlobal, tagId);
					});

					updateTransaction();
				} else {
					// No force update, just check for duplicates and update
					const existing = db.prepare(
						'SELECT id FROM tag WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL)) AND id != ?'
					).get(sanitizedName, newLibraryId, newLibraryId, tagId);
					if (existing) {
						const scope = isGlobal ? 'global' : 'this library';
						throw new DuplicateEntryError('Tag', 'name', `${sanitizedName} (already exists in ${scope})`);
					}

					db.prepare(
						'UPDATE tag SET name = ?, library_id = ?, is_global = ? WHERE id = ?'
					).run(sanitizedName, newLibraryId, isGlobal, tagId);
				}
			} else {
				// Not converting from global to library-specific, just update
				const existing = db.prepare(
					'SELECT id FROM tag WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL)) AND id != ?'
				).get(sanitizedName, newLibraryId, newLibraryId, tagId);
				if (existing) {
					const scope = isGlobal ? 'global' : 'this library';
					throw new DuplicateEntryError('Tag', 'name', `${sanitizedName} (already exists in ${scope})`);
				}

				db.prepare(
					'UPDATE tag SET name = ?, library_id = ?, is_global = ? WHERE id = ?'
				).run(sanitizedName, newLibraryId, isGlobal, tagId);
			}
		}

		const updatedTag = db.prepare('SELECT * FROM tag WHERE id = ?').get(tagId);
		logger.info(`Tag updated: ${tagId}`);

		return json(updatedTag);
	} catch (err) {
		logger.error('Failed to update tag', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const tagId = sanitizeInteger(params.id);

		const db = getDatabase();
		
		const tag = db.prepare('SELECT id FROM tag WHERE id = ?').get(tagId);
		if (!tag) {
			error(404, 'Tag not found');
		}

		db.prepare('DELETE FROM tag WHERE id = ?').run(tagId);

		logger.info(`Tag deleted: ${tagId}`);
		
		return json({ success: true });
	} catch (err) {
		logger.error('Failed to delete tag', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
