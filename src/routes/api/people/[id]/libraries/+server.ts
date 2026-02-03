import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Library } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:person-libraries');

export const GET: RequestHandler = async ({ params }) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT id FROM person WHERE id = ?').get(personId);
		if (!person) {
			error(404, 'Person not found');
		}

		// Get all libraries that contain media credited to this person
		const libraries = db.prepare(`
			SELECT DISTINCT l.*
			FROM library l
			INNER JOIN media m ON m.library_id = l.id
			INNER JOIN media_credit mc ON mc.media_id = m.id
			WHERE mc.person_id = ?
			ORDER BY l.name ASC
		`).all(personId) as Library[];

		return json(libraries);
	} catch (err) {
		logger.error('Failed to fetch person libraries', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
