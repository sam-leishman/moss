import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger, sanitizeTitle } from '$lib/server/security';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);

	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as Media | undefined;

	if (!media) {
		error(404, 'Media not found');
	}

	return json(media);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);

	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as Media | undefined;

	if (!media) {
		error(404, 'Media not found');
	}

	let body: { title?: string | null };
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { title } = body;

	if (title !== null && title !== undefined && typeof title !== 'string') {
		error(400, 'Title must be a string or null');
	}

	let sanitizedTitle: string | null = null;
	
	if (title !== null && title !== undefined) {
		const cleaned = sanitizeTitle(title);
		sanitizedTitle = cleaned.length > 0 ? cleaned : null;
	}

	const stmt = db.prepare(`
		UPDATE media 
		SET title = ?, updated_at = datetime('now')
		WHERE id = ?
	`);

	stmt.run(sanitizedTitle, mediaId);

	const updatedMedia = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as Media;

	return json(updatedMedia);
};
