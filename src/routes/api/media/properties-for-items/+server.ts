import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { ValidationError } from '$lib/server/errors/app-errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';

const logger = getLogger('api:media:properties-for-items');

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
		const placeholders = sanitizedMediaIds.map(() => '?').join(',');
		const totalSelected = sanitizedMediaIds.length;

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

		const tagsWithState = tagCounts.map(tag => ({
			id: tag.id,
			name: tag.name,
			appliedCount: tag.count,
			totalCount: totalSelected,
			state: tag.count === 0 ? 'none' : tag.count === totalSelected ? 'all' : 'some'
		}));

		const personCounts = db.prepare(`
			SELECT 
				p.id,
				p.name,
				p.role,
				COUNT(DISTINCT mc.media_id) as count
			FROM person p
			LEFT JOIN media_credit mc ON mc.person_id = p.id AND mc.media_id IN (${placeholders})
			GROUP BY p.id, p.name, p.role
			ORDER BY p.name ASC
		`).all(...sanitizedMediaIds) as Array<{ id: number; name: string; role: string; count: number }>;

		const creditsWithState = personCounts.map(person => ({
			id: person.id,
			name: person.name,
			role: person.role,
			appliedCount: person.count,
			totalCount: totalSelected,
			state: person.count === 0 ? 'none' : person.count === totalSelected ? 'all' : 'some'
		}));

		logger.info(`Fetched property states for ${sanitizedMediaIds.length} media items`);

		return json({
			tags: tagsWithState,
			credits: creditsWithState
		});
	} catch (err) {
		logger.error('Failed to fetch properties for items', err instanceof Error ? err : new Error(String(err)));
		error(500, 'Failed to fetch properties for items');
	}
};
