import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { getThumbnailGenerator } from '$lib/server/thumbnails';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	const db = getDatabase();
	const thumbnailGen = getThumbnailGenerator();

	const allMedia = db.prepare('SELECT path FROM media').all() as Array<{ path: string }>;
	const validPaths = new Set(allMedia.map((m) => m.path));

	const deletedCount = await thumbnailGen.cleanupOrphanedThumbnails(validPaths);

	return json({
		success: true,
		deletedCount,
		message: `Cleaned up ${deletedCount} orphaned thumbnails`
	});
};
