import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Person } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:person-collaborators');

export const GET: RequestHandler = async ({ params }) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT id FROM person WHERE id = ?').get(personId);
		if (!person) {
			error(404, 'Person not found');
		}

		// Get all people who are credited on the same media as this person
		// Exclude the current person from results
		const collaborators = db.prepare(`
			SELECT DISTINCT p.*
			FROM person p
			INNER JOIN media_credit mc ON mc.person_id = p.id
			WHERE mc.media_id IN (
				SELECT media_id FROM media_credit WHERE person_id = ?
			)
			AND p.id != ?
			ORDER BY p.name ASC
		`).all(personId, personId) as Person[];

		return json(collaborators);
	} catch (err) {
		logger.error('Failed to fetch person collaborators', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
