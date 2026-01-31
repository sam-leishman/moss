import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { NotFoundError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { scanLibrary } from '$lib/server/scanner/library-scanner';
import type { Library } from '$lib/server/db';

const logger = getLogger('api:scan');

export const POST = async ({ params }: { params: { id: string } }) => {
	try {
		const db = getDatabase();
		const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;

		if (!library) {
			throw new NotFoundError('Library', params.id);
		}

		logger.info(`Starting scan for library: ${library.name} (id: ${params.id})`);

		const stats = await scanLibrary(library);

		const pathMissingError = stats.errors.find(e => 
			e.path === library.folder_path && 
			e.error === 'Library folder does not exist or is not accessible'
		);

		if (pathMissingError) {
			logger.error(`Library ${params.id} path is missing`);
			
			return json({
				success: false,
				error: 'Library folder does not exist or is not accessible. Please relocate or delete this library.',
				pathMissing: true,
				stats: {
					totalScanned: stats.totalScanned,
					added: stats.added,
					updated: stats.updated,
					removed: stats.removed,
					errors: stats.errors.length,
					duration: stats.duration
				}
			}, { status: 400 });
		}

		logger.info(`Scan completed for library ${params.id}: ${stats.added} added, ${stats.updated} updated, ${stats.removed} removed`);

		return json({
			success: true,
			stats: {
				totalScanned: stats.totalScanned,
				added: stats.added,
				updated: stats.updated,
				removed: stats.removed,
				errors: stats.errors.length,
				duration: stats.duration
			},
			errors: stats.errors.length > 0 ? stats.errors : undefined
		});
	} catch (error) {
		logger.error(`Failed to scan library ${params.id}`, error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
