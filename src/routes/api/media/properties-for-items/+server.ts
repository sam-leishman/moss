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

		// Determine the library_id from the selected media items
		// All selected items should belong to the same library
		const libraryResult = db.prepare(`
			SELECT DISTINCT library_id FROM media WHERE id IN (${placeholders})
		`).all(...sanitizedMediaIds) as Array<{ library_id: number }>;

		if (libraryResult.length === 0) {
			throw new ValidationError('No valid media items found');
		}

		if (libraryResult.length > 1) {
			throw new ValidationError('Cannot bulk edit items from different libraries');
		}

		const libraryId = libraryResult[0].library_id;

		// Get tags filtered by library (global tags + library-specific tags)
		const tagCounts = db.prepare(`
			SELECT 
				t.id,
				t.name,
				COUNT(DISTINCT mt.media_id) as count
			FROM tag t
			LEFT JOIN media_tag mt ON mt.tag_id = t.id AND mt.media_id IN (${placeholders})
			WHERE (t.library_id = ? OR t.is_global = 1)
			GROUP BY t.id, t.name
			ORDER BY t.is_global DESC, t.name ASC
		`).all(...sanitizedMediaIds, libraryId) as Array<{ id: number; name: string; count: number }>;

		const tagsWithState = tagCounts.map(tag => ({
			id: tag.id,
			name: tag.name,
			appliedCount: tag.count,
			totalCount: totalSelected,
			state: tag.count === 0 ? 'none' : tag.count === totalSelected ? 'all' : 'some'
		}));

		// Get people filtered by library (global people + library-specific people)
		const personCounts = db.prepare(`
			SELECT 
				p.id,
				p.name,
				p.role,
				COUNT(DISTINCT mc.media_id) as count
			FROM person p
			LEFT JOIN media_credit mc ON mc.person_id = p.id AND mc.media_id IN (${placeholders})
			WHERE (p.library_id = ? OR p.is_global = 1)
			GROUP BY p.id, p.name, p.role
			ORDER BY p.is_global DESC, p.name ASC
		`).all(...sanitizedMediaIds, libraryId) as Array<{ id: number; name: string; role: string; count: number }>;

		const creditsWithState = personCounts.map(person => ({
			id: person.id,
			name: person.name,
			role: person.role,
			appliedCount: person.count,
			totalCount: totalSelected,
			state: person.count === 0 ? 'none' : person.count === totalSelected ? 'all' : 'some'
		}));

		logger.info(`Fetched property states for ${sanitizedMediaIds.length} media items in library ${libraryId}`);

		return json({
			tags: tagsWithState,
			credits: creditsWithState
		});
	} catch (err) {
		if (err instanceof ValidationError) {
			throw err;
		}
		logger.error('Failed to fetch properties for items', err instanceof Error ? err : new Error(String(err)));
		error(500, 'Failed to fetch properties for items');
	}
};
