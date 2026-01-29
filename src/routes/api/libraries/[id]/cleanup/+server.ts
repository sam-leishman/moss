import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { NotFoundError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { cleanupOrphanedMediaForLibrary } from '$lib/server/scanner/library-scanner';
import type { Library } from '$lib/server/db';

const logger = getLogger('api:cleanup');

export const POST = async ({ params }: { params: { id: string } }) => {
	try {
		const db = getDatabase();
		const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;

		if (!library) {
			throw new NotFoundError('Library', params.id);
		}

		logger.info(`Starting orphaned media cleanup for library: ${library.name} (id: ${params.id})`);

		const removedCount = await cleanupOrphanedMediaForLibrary(library.id);

		logger.info(`Cleanup completed for library ${params.id}: ${removedCount} orphaned files removed`);

		return json({
			success: true,
			removedCount
		});
	} catch (error) {
		logger.error(`Failed to cleanup library ${params.id}`, error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
