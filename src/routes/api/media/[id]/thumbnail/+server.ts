import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { getThumbnailGenerator } from '$lib/server/thumbnails';
import { existsSync, createReadStream } from 'fs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);

	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as Media | undefined;

	if (!media) {
		error(404, 'Media not found');
	}

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
			console.error('Thumbnail stream error:', err);
		});
		
		return new Response(stream as any, {
			headers: {
				'Content-Type': 'image/webp',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		error(500, `Failed to generate thumbnail: ${errorMessage}`);
	}
};
