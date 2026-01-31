import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Person } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:media-credits');

export const GET: RequestHandler = async ({ params }) => {
	try {
		const mediaId = sanitizeInteger(params.id);

		const db = getDatabase();
		
		const media = db.prepare('SELECT id FROM media WHERE id = ?').get(mediaId);
		if (!media) {
			error(404, 'Media not found');
		}

		const credits = db.prepare(`
			SELECT p.* FROM person p
			INNER JOIN media_credit mc ON mc.person_id = p.id
			WHERE mc.media_id = ?
			ORDER BY p.name ASC
		`).all(mediaId) as Person[];
		
		return json(credits);
	} catch (err) {
		logger.error('Failed to fetch media credits', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const mediaId = sanitizeInteger(params.id);
		const { person_id } = await request.json();

		if (!person_id) {
			throw new ValidationError('person_id is required');
		}

		const personId = sanitizeInteger(person_id);

		const db = getDatabase();
		
		const media = db.prepare('SELECT id FROM media WHERE id = ?').get(mediaId);
		if (!media) {
			error(404, 'Media not found');
		}

		const person = db.prepare('SELECT id FROM person WHERE id = ?').get(personId);
		if (!person) {
			error(404, 'Person not found');
		}

		const existing = db.prepare(
			'SELECT 1 FROM media_credit WHERE media_id = ? AND person_id = ?'
		).get(mediaId, personId);

		if (existing) {
			return json({ success: true, message: 'Credit already assigned' });
		}

		db.prepare('INSERT INTO media_credit (media_id, person_id) VALUES (?, ?)').run(mediaId, personId);

		logger.info(`Credit ${personId} assigned to media ${mediaId}`);
		
		return json({ success: true }, { status: 201 });
	} catch (err) {
		logger.error('Failed to assign credit to media', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	try {
		const mediaId = sanitizeInteger(params.id);
		const personIdParam = url.searchParams.get('person_id');

		if (!personIdParam) {
			throw new ValidationError('person_id is required');
		}

		const personId = sanitizeInteger(personIdParam);

		const db = getDatabase();
		
		const result = db.prepare(
			'DELETE FROM media_credit WHERE media_id = ? AND person_id = ?'
		).run(mediaId, personId);

		if (result.changes === 0) {
			error(404, 'Credit assignment not found');
		}

		logger.info(`Credit ${personId} removed from media ${mediaId}`);
		
		return json({ success: true });
	} catch (err) {
		logger.error('Failed to remove credit from media', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
