import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Tag } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:person-tags');

export const GET: RequestHandler = async ({ params }) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT id FROM person WHERE id = ?').get(personId);
		if (!person) {
			error(404, 'Person not found');
		}

		// Get all tags that are used in media credited to this person
		const tags = db.prepare(`
			SELECT DISTINCT t.*
			FROM tag t
			INNER JOIN media_tag mt ON mt.tag_id = t.id
			INNER JOIN media m ON m.id = mt.media_id
			INNER JOIN media_credit mc ON mc.media_id = m.id
			WHERE mc.person_id = ?
			ORDER BY t.name ASC
		`).all(personId) as Tag[];

		return json(tags);
	} catch (err) {
		logger.error('Failed to fetch person tags', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
