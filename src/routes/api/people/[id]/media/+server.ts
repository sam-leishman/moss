import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Media } from '$lib/server/db';
import type { RequestHandler } from './$types';
import type { MediaType } from '$lib/server/security';

const logger = getLogger('api:person-media');

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT id FROM person WHERE id = ?').get(personId);
		if (!person) {
			error(404, 'Person not found');
		}

		// Parse query parameters
		const page = sanitizeInteger(url.searchParams.get('page') || '1', { min: 1 });
		const pageSize = sanitizeInteger(url.searchParams.get('page_size') || '50', { min: 1, max: 100 });
		const offset = (page - 1) * pageSize;

		const searchParam = url.searchParams.get('search');
		const mediaTypeParam = url.searchParams.get('media_type');
		const libraryIdParam = url.searchParams.get('library_id');
		const tagIdsParam = url.searchParams.get('tag_ids');
		const additionalPersonIdsParam = url.searchParams.get('person_ids');

		// Build WHERE conditions
		const conditions: string[] = ['mc.person_id = ?'];
		const queryParams: any[] = [personId];

		if (searchParam && searchParam.trim()) {
			const searchTerm = `%${searchParam.trim()}%`;
			conditions.push('(m.title LIKE ? OR m.path LIKE ?)');
			queryParams.push(searchTerm, searchTerm);
		}

		if (mediaTypeParam && mediaTypeParam !== 'all') {
			conditions.push('m.media_type = ?');
			queryParams.push(mediaTypeParam);
		}

		if (libraryIdParam) {
			const libId = sanitizeInteger(libraryIdParam);
			conditions.push('m.library_id = ?');
			queryParams.push(libId);
		}

		if (tagIdsParam) {
			const tagIdArray = tagIdsParam.split(',').map(id => sanitizeInteger(id));
			const tagPlaceholders = tagIdArray.map(() => '?').join(',');
			conditions.push(`m.id IN (
				SELECT media_id FROM media_tag 
				WHERE tag_id IN (${tagPlaceholders})
				GROUP BY media_id
				HAVING COUNT(DISTINCT tag_id) = ?
			)`);
			queryParams.push(...tagIdArray, tagIdArray.length);
		}

		if (additionalPersonIdsParam) {
			const personIdArray = additionalPersonIdsParam.split(',').map(id => sanitizeInteger(id));
			const filteredPersonIds = personIdArray.filter(id => id !== personId);
			
			if (filteredPersonIds.length > 0) {
				const personPlaceholders = filteredPersonIds.map(() => '?').join(',');
				conditions.push(`m.id IN (
					SELECT media_id FROM media_credit 
					WHERE person_id IN (${personPlaceholders})
					GROUP BY media_id
					HAVING COUNT(DISTINCT person_id) = ?
				)`);
				queryParams.push(...filteredPersonIds, filteredPersonIds.length);
			}
		}

		const whereClause = conditions.join(' AND ');

		// Get total count
		const countQuery = `
			SELECT COUNT(DISTINCT m.id) as total
			FROM media m
			INNER JOIN media_credit mc ON mc.media_id = m.id
			WHERE ${whereClause}
		`;
		const { total } = db.prepare(countQuery).get(...queryParams) as { total: number };

		// Get paginated media
		const mediaQuery = `
			SELECT DISTINCT m.*
			FROM media m
			INNER JOIN media_credit mc ON mc.media_id = m.id
			WHERE ${whereClause}
			ORDER BY m.created_at DESC
			LIMIT ? OFFSET ?
		`;
		const media = db.prepare(mediaQuery).all(...queryParams, pageSize, offset) as Media[];

		const totalPages = Math.ceil(total / pageSize);

		return json({
			items: media,
			total,
			page,
			pageSize,
			totalPages
		});
	} catch (err) {
		logger.error('Failed to fetch person media', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
