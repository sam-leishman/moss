import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { NotFoundError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { scanLibrary } from '$lib/server/scanner/library-scanner';
import type { Library } from '$lib/server/db';
import type { ScanProgress } from '$lib/server/scanner/library-scanner';

const logger = getLogger('api:scan');

export const POST = async ({ params }: { params: { id: string } }) => {
	const db = getDatabase();
	const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;

	if (!library) {
		return handleError(new NotFoundError('Library', params.id));
	}

	logger.info(`Starting scan for library: ${library.name} (id: ${params.id})`);

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const send = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			const onProgress = (progress: ScanProgress) => {
				send('progress', progress);
			};

			try {
				const stats = await scanLibrary(library, onProgress);

				const pathMissingError = stats.errors.find(e =>
					e.path === library.folder_path &&
					e.error === 'Library folder does not exist or is not accessible'
				);

				if (pathMissingError) {
					logger.error(`Library ${params.id} path is missing`);
					send('error', {
						error: 'Library folder does not exist or is not accessible. Please relocate or delete this library.',
						pathMissing: true
					});
				} else {
					logger.info(`Scan completed for library ${params.id}: ${stats.added} added, ${stats.updated} updated, ${stats.removed} removed`);
					send('complete', {
						success: true,
						stats: {
							totalScanned: stats.totalScanned,
							added: stats.added,
							updated: stats.updated,
							removed: stats.removed,
							thumbnailsGenerated: stats.thumbnailsGenerated,
							errors: stats.errors.length,
							duration: stats.duration
						},
						errors: stats.errors.length > 0 ? stats.errors : undefined
					});
				}
			} catch (error) {
				logger.error(`Failed to scan library ${params.id}`, error instanceof Error ? error : undefined);
				send('error', {
					error: error instanceof Error ? error.message : 'Scan failed'
				});
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
