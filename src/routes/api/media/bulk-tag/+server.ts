import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { ValidationError } from '$lib/server/errors/app-errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';

const logger = getLogger('api:media:bulk-tag');

interface BulkTagRequest {
	media_ids: number[];
	tag_ids: number[];
	operation: 'add' | 'remove';
}

export const POST: RequestHandler = async ({ request }) => {
	const db = getDatabase();
	
	let body: BulkTagRequest;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { media_ids, tag_ids, operation } = body;

	if (!Array.isArray(media_ids) || media_ids.length === 0) {
		throw new ValidationError('media_ids must be a non-empty array');
	}

	if (!Array.isArray(tag_ids) || tag_ids.length === 0) {
		throw new ValidationError('tag_ids must be a non-empty array');
	}

	if (operation !== 'add' && operation !== 'remove') {
		throw new ValidationError('operation must be "add" or "remove"');
	}

	const sanitizedMediaIds = media_ids.map(id => sanitizeInteger(id));
	const sanitizedTagIds = tag_ids.map(id => sanitizeInteger(id));

	logger.info(`Bulk ${operation} tags`, {
		mediaCount: sanitizedMediaIds.length,
		tagCount: sanitizedTagIds.length
	});

	try {
		// Use transaction for atomicity
		db.transaction(() => {
			if (operation === 'add') {
				// Add tags to media items
				const insertStmt = db.prepare(`
					INSERT OR IGNORE INTO media_tag (media_id, tag_id)
					VALUES (?, ?)
				`);

				for (const mediaId of sanitizedMediaIds) {
					// Verify media exists
					const media = db.prepare('SELECT id FROM media WHERE id = ?').get(mediaId);
					if (!media) {
						throw new ValidationError(`Media with id ${mediaId} not found`);
					}

					for (const tagId of sanitizedTagIds) {
						// Verify tag exists
						const tag = db.prepare('SELECT id FROM tag WHERE id = ?').get(tagId);
						if (!tag) {
							throw new ValidationError(`Tag with id ${tagId} not found`);
						}

						insertStmt.run(mediaId, tagId);
					}
				}

				logger.info(`Successfully added tags to ${sanitizedMediaIds.length} media items`);
			} else {
				// Remove tags from media items
				const deleteStmt = db.prepare(`
					DELETE FROM media_tag
					WHERE media_id = ? AND tag_id = ?
				`);

				for (const mediaId of sanitizedMediaIds) {
					for (const tagId of sanitizedTagIds) {
						deleteStmt.run(mediaId, tagId);
					}
				}

				logger.info(`Successfully removed tags from ${sanitizedMediaIds.length} media items`);
			}
		})();

		return json({
			success: true,
			message: `Successfully ${operation === 'add' ? 'added' : 'removed'} tags ${operation === 'add' ? 'to' : 'from'} ${sanitizedMediaIds.length} media item(s)`
		});
	} catch (err) {
		if (err instanceof ValidationError) {
			throw err;
		}
		logger.error('Bulk tag operation failed', err instanceof Error ? err : new Error(String(err)));
		error(500, 'Failed to perform bulk tag operation');
	}
};
