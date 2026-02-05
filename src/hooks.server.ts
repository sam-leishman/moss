import { initializeDatabase, getDatabase } from '$lib/server/db';
import { getThumbnailGenerator } from '$lib/server/thumbnails';
import { getLogger } from '$lib/server/logging';
import { validateSession, cleanupExpiredSessions } from '$lib/server/auth';
import { validateStartupEnvironment } from '$lib/server/startup-validation';
import type { Handle } from '@sveltejs/kit';

const logger = getLogger('hooks');

// Validate environment before initializing database
try {
	validateStartupEnvironment();
} catch (error) {
	console.error('Startup validation failed:', error);
	process.exit(1);
}

initializeDatabase().catch(error => {
	console.error('Database initialization failed:', error);
	process.exit(1);
});

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

// Periodic session cleanup to remove expired sessions
const startSessionCleanupJob = () => {
	const runCleanup = () => {
		try {
			const db = getDatabase();
			const deletedCount = cleanupExpiredSessions(db);
			if (deletedCount > 0) {
				logger.info(`Session cleanup: removed ${deletedCount} expired sessions`);
			}
		} catch (error) {
			logger.error('Session cleanup failed', error instanceof Error ? error : undefined);
		}
	};
	
	// Run cleanup on startup
	runCleanup();
	
	// Run cleanup hourly
	setInterval(runCleanup, 60 * 60 * 1000);
};

startThumbnailCleanupJob();
startSessionCleanupJob();

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');
	
	if (sessionId) {
		// Validate session ID format (64 hex characters from randomBytes(32))
		if (!/^[a-f0-9]{64}$/.test(sessionId)) {
			event.cookies.delete('session', { path: '/' });
			return resolve(event);
		}
		
		try {
			const db = getDatabase();
			const result = validateSession(db, sessionId);
			
			if (result) {
				event.locals.user = result.user;
				event.locals.session = result.session;
			} else {
				event.cookies.delete('session', { path: '/' });
			}
		} catch (error) {
			logger.error('Session validation failed', error instanceof Error ? error : undefined);
			event.cookies.delete('session', { path: '/' });
		}
	}
	
	return resolve(event);
}
