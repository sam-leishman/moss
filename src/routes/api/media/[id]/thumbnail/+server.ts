import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import { getThumbnailGenerator } from '$lib/server/thumbnails';
import { getLogger } from '$lib/server/logging';
import { existsSync, createReadStream } from 'fs';
import type { RequestHandler } from './$types';

const logger = getLogger('api:thumbnail');

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);

	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as Media | undefined;

	if (!media) {
		error(404, 'Media not found');
	}
	
	requireLibraryAccess(locals, media.library_id);

	if (!existsSync(media.path)) {
		error(404, 'Media file not found on disk');
	}

	const thumbnailGen = getThumbnailGenerator();

	try {
		const thumbnailPath = await thumbnailGen.generateThumbnail(
			media.path,
			media.media_type
		);

		const stream = createReadStream(thumbnailPath);

		stream.on('error', (err) => {
			logger.error('Thumbnail stream error', err instanceof Error ? err : undefined);
		});
		
		return new Response(stream as any, {
			headers: {
				'Content-Type': 'image/webp',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (err) {
		logger.debug(`Thumbnail not available for media ${mediaId}: ${err instanceof Error ? err.message : String(err)}`);
		return new Response(null, {
			status: 404,
			headers: {
				'Cache-Control': 'no-cache'
			}
		});
	}
};
