import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizePositiveInteger } from '$lib/server/security/sanitizer';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { requireAuth, requireLibraryAccess } from '$lib/server/auth/middleware';
import { toggleMediaLike, isMediaLiked } from '$lib/server/db/likes';
import type { RequestHandler } from './$types';

const logger = getLogger('api:media-like');

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const user = requireAuth(locals);
		const mediaId = sanitizePositiveInteger(params.id);

		const db = getDatabase();
		
		const media = db.prepare('SELECT id, library_id FROM media WHERE id = ?').get(mediaId) as Media | undefined;
		if (!media) {
			error(404, 'Media not found');
		}
		
		requireLibraryAccess(locals, media.library_id);

		const liked = isMediaLiked(db, user.id, mediaId);
		
		return json({ liked });
	} catch (err) {
		logger.error('Failed to check like status', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const POST: RequestHandler = async ({ params, locals }) => {
	try {
		const user = requireAuth(locals);
		const mediaId = sanitizePositiveInteger(params.id);

		const db = getDatabase();
		
		const media = db.prepare('SELECT id, library_id FROM media WHERE id = ?').get(mediaId) as Media | undefined;
		if (!media) {
			error(404, 'Media not found');
		}
		
		requireLibraryAccess(locals, media.library_id);

		const liked = toggleMediaLike(db, user.id, mediaId);

		logger.info(`User ${user.id} ${liked ? 'liked' : 'unliked'} media ${mediaId}`);
		
		return json({ liked });
	} catch (err) {
		logger.error('Failed to toggle like status', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
