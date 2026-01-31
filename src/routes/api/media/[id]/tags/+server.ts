import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Tag } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:media-tags');

export const GET: RequestHandler = async ({ params }) => {
	try {
		const mediaId = sanitizeInteger(params.id);

		const db = getDatabase();
		
		const media = db.prepare('SELECT id FROM media WHERE id = ?').get(mediaId);
		if (!media) {
			error(404, 'Media not found');
		}

		const tags = db.prepare(`
			SELECT t.* FROM tag t
			INNER JOIN media_tag mt ON mt.tag_id = t.id
			WHERE mt.media_id = ?
			ORDER BY t.name ASC
		`).all(mediaId) as Tag[];
		
		return json(tags);
	} catch (err) {
		logger.error('Failed to fetch media tags', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const mediaId = sanitizeInteger(params.id);
		const { tag_id } = await request.json();

		if (!tag_id) {
			throw new ValidationError('tag_id is required');
		}

		const tagId = sanitizeInteger(tag_id);

		const db = getDatabase();
		
		const media = db.prepare('SELECT id FROM media WHERE id = ?').get(mediaId);
		if (!media) {
			error(404, 'Media not found');
		}

		const tag = db.prepare('SELECT id FROM tag WHERE id = ?').get(tagId);
		if (!tag) {
			error(404, 'Tag not found');
		}

		const existing = db.prepare(
			'SELECT 1 FROM media_tag WHERE media_id = ? AND tag_id = ?'
		).get(mediaId, tagId);

		if (existing) {
			return json({ success: true, message: 'Tag already assigned' });
		}

		db.prepare('INSERT INTO media_tag (media_id, tag_id) VALUES (?, ?)').run(mediaId, tagId);

		logger.info(`Tag ${tagId} assigned to media ${mediaId}`);
		
		return json({ success: true }, { status: 201 });
	} catch (err) {
		logger.error('Failed to assign tag to media', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	try {
		const mediaId = sanitizeInteger(params.id);
		const tagIdParam = url.searchParams.get('tag_id');

		if (!tagIdParam) {
			throw new ValidationError('tag_id is required');
		}

		const tagId = sanitizeInteger(tagIdParam);

		const db = getDatabase();
		
		const result = db.prepare(
			'DELETE FROM media_tag WHERE media_id = ? AND tag_id = ?'
		).run(mediaId, tagId);

		if (result.changes === 0) {
			error(404, 'Tag assignment not found');
		}

		logger.info(`Tag ${tagId} removed from media ${mediaId}`);
		
		return json({ success: true });
	} catch (err) {
		logger.error('Failed to remove tag from media', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
