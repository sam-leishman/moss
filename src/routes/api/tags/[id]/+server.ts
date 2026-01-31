import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';

const logger = getLogger('api:tags');

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const tagId = sanitizeInteger(params.id);

		const db = getDatabase();
		
		const tag = db.prepare('SELECT id FROM tag WHERE id = ?').get(tagId);
		if (!tag) {
			error(404, 'Tag not found');
		}

		db.prepare('DELETE FROM tag WHERE id = ?').run(tagId);

		logger.info(`Tag deleted: ${tagId}`);
		
		return json({ success: true });
	} catch (err) {
		logger.error('Failed to delete tag', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
