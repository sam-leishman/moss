import { initializeDatabase, getDatabase } from '$lib/server/db';
import { getThumbnailGenerator } from '$lib/server/thumbnails';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('hooks');

initializeDatabase();

// Periodic thumbnail cleanup to catch any orphaned thumbnails
const startThumbnailCleanupJob = () => {
	const runCleanup = async () => {
		try {
			const db = getDatabase();
			const thumbnailGen = getThumbnailGenerator();
			
			const allMedia = db.prepare('SELECT path FROM media').all() as Array<{ path: string }>;
			const validPaths = new Set(allMedia.map((m) => m.path));
			
			const deletedCount = await thumbnailGen.cleanupOrphanedThumbnails(validPaths);
			
			if (deletedCount > 0) {
				logger.info(`Periodic cleanup: removed ${deletedCount} orphaned thumbnails`);
			}
		} catch (error) {
			logger.error('Periodic thumbnail cleanup failed', error instanceof Error ? error : undefined);
		}
	};
	
	// Run cleanup on startup
	runCleanup();
	
	// Run cleanup daily
	setInterval(runCleanup, 24 * 60 * 60 * 1000);
};

startThumbnailCleanupJob();

export async function handle({ event, resolve }) {
	return resolve(event);
}
