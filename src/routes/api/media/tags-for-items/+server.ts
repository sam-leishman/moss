import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { ValidationError } from '$lib/server/errors/app-errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';

const logger = getLogger('api:media:tags-for-items');

export const POST: RequestHandler = async ({ request }) => {
	const db = getDatabase();
	
	let body: { media_ids: number[] };
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { media_ids } = body;

	if (!Array.isArray(media_ids) || media_ids.length === 0) {
		throw new ValidationError('media_ids must be a non-empty array');
	}

	const sanitizedMediaIds = media_ids.map(id => sanitizeInteger(id));

	try {
		// Get all tags with count of how many selected items have each tag
		const placeholders = sanitizedMediaIds.map(() => '?').join(',');
		const tagCounts = db.prepare(`
			SELECT 
				t.id,
				t.name,
				COUNT(DISTINCT mt.media_id) as count
			FROM tag t
			LEFT JOIN media_tag mt ON mt.tag_id = t.id AND mt.media_id IN (${placeholders})
			GROUP BY t.id, t.name
			ORDER BY t.name ASC
		`).all(...sanitizedMediaIds) as Array<{ id: number; name: string; count: number }>;

		const totalSelected = sanitizedMediaIds.length;

		// Map to include application state
		const tagsWithState = tagCounts.map(tag => ({
			id: tag.id,
			name: tag.name,
			appliedCount: tag.count,
			totalCount: totalSelected,
			state: tag.count === 0 ? 'none' : tag.count === totalSelected ? 'all' : 'some'
		}));

		logger.info(`Fetched tag states for ${sanitizedMediaIds.length} media items`);

		return json(tagsWithState);
	} catch (err) {
		logger.error('Failed to fetch tags for items', err instanceof Error ? err : new Error(String(err)));
		error(500, 'Failed to fetch tags for items');
	}
};
