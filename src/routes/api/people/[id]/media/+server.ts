import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Media } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:person-media');

export const GET: RequestHandler = async ({ params }) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT id FROM person WHERE id = ?').get(personId);
		if (!person) {
			error(404, 'Person not found');
		}

		const media = db.prepare(`
			SELECT m.* FROM media m
			INNER JOIN media_credit mc ON mc.media_id = m.id
			WHERE mc.person_id = ?
			ORDER BY m.created_at DESC
		`).all(personId) as Media[];

		return json(media);
	} catch (err) {
		logger.error('Failed to fetch person media', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
