import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { ValidationError } from '$lib/server/errors/app-errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';

const logger = getLogger('api:media:bulk-edit');

type PropertyType = 'tags' | 'credits';
type OperationType = 'add' | 'remove';

interface BulkEditRequest {
	media_ids: number[];
	property: PropertyType;
	operation: OperationType;
	value: number[];
}

export const POST: RequestHandler = async ({ request }) => {
	const db = getDatabase();
	
	let body: BulkEditRequest;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { media_ids, property, operation, value } = body;

	if (!Array.isArray(media_ids) || media_ids.length === 0) {
		throw new ValidationError('media_ids must be a non-empty array');
	}

	if (!['tags', 'credits'].includes(property)) {
		throw new ValidationError('property must be "tags" or "credits"');
	}

	if (!['add', 'remove'].includes(operation)) {
		throw new ValidationError('operation must be "add" or "remove"');
	}

	if (!Array.isArray(value) || value.length === 0) {
		throw new ValidationError('value must be a non-empty array');
	}

	const sanitizedMediaIds = media_ids.map(id => sanitizeInteger(id));
	const sanitizedValues = value.map(id => sanitizeInteger(id));

	logger.info(`Bulk ${operation} ${property}`, {
		mediaCount: sanitizedMediaIds.length,
		valueCount: sanitizedValues.length
	});

	try {
		db.transaction(() => {
			if (property === 'tags') {
				handleTagsOperation(db, sanitizedMediaIds, sanitizedValues, operation);
			} else if (property === 'credits') {
				handleCreditsOperation(db, sanitizedMediaIds, sanitizedValues, operation);
			}
		})();

		return json({
			success: true,
			message: `Successfully ${operation === 'add' ? 'added' : 'removed'} ${property} ${operation === 'add' ? 'to' : 'from'} ${sanitizedMediaIds.length} media item(s)`
		});
	} catch (err) {
		if (err instanceof ValidationError) {
			throw err;
		}
		logger.error('Bulk edit operation failed', err instanceof Error ? err : new Error(String(err)));
		error(500, 'Failed to perform bulk edit operation');
	}
};

function handleTagsOperation(
	db: any,
	mediaIds: number[],
	tagIds: number[],
	operation: OperationType
) {
	if (operation === 'add') {
		const insertStmt = db.prepare(`
			INSERT OR IGNORE INTO media_tag (media_id, tag_id)
			VALUES (?, ?)
		`);

		for (const mediaId of mediaIds) {
			const media = db.prepare('SELECT id FROM media WHERE id = ?').get(mediaId);
			if (!media) {
				throw new ValidationError(`Media with id ${mediaId} not found`);
			}

			for (const tagId of tagIds) {
				const tag = db.prepare('SELECT id FROM tag WHERE id = ?').get(tagId);
				if (!tag) {
					throw new ValidationError(`Tag with id ${tagId} not found`);
				}

				insertStmt.run(mediaId, tagId);
			}
		}
	} else {
		const deleteStmt = db.prepare(`
			DELETE FROM media_tag
			WHERE media_id = ? AND tag_id = ?
		`);

		for (const mediaId of mediaIds) {
			for (const tagId of tagIds) {
				deleteStmt.run(mediaId, tagId);
			}
		}
	}
}

function handleCreditsOperation(
	db: any,
	mediaIds: number[],
	personIds: number[],
	operation: OperationType
) {
	if (operation === 'add') {
		const insertStmt = db.prepare(`
			INSERT OR IGNORE INTO media_credit (media_id, person_id)
			VALUES (?, ?)
		`);

		for (const mediaId of mediaIds) {
			const media = db.prepare('SELECT id FROM media WHERE id = ?').get(mediaId);
			if (!media) {
				throw new ValidationError(`Media with id ${mediaId} not found`);
			}

			for (const personId of personIds) {
				const person = db.prepare('SELECT id FROM person WHERE id = ?').get(personId);
				if (!person) {
					throw new ValidationError(`Person with id ${personId} not found`);
				}

				insertStmt.run(mediaId, personId);
			}
		}
	} else {
		const deleteStmt = db.prepare(`
			DELETE FROM media_credit
			WHERE media_id = ? AND person_id = ?
		`);

		for (const mediaId of mediaIds) {
			for (const personId of personIds) {
				deleteStmt.run(mediaId, personId);
			}
		}
	}
}
