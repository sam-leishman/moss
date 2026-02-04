import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { requireAuth } from '$lib/server/auth/middleware';
import { getUserLibraries } from '$lib/server/auth/permissions';
import { getUserLikedMediaIds } from '$lib/server/db/likes';
import type { RequestHandler } from './$types';

const logger = getLogger('api:media-liked');

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const user = requireAuth(locals);
		const db = getDatabase();

		const accessibleLibraryIds = getUserLibraries(db, user);
		const likedMediaIds = getUserLikedMediaIds(db, user.id, accessibleLibraryIds);
		
		return json({ mediaIds: likedMediaIds });
	} catch (err) {
		logger.error('Failed to fetch liked media', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
