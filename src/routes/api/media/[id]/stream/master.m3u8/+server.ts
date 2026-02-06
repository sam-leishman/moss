import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import { getAvailableQualities, generateMasterPlaylist } from '$lib/server/streaming';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);

	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as Media | undefined;

	if (!media) {
		error(404, 'Media not found');
	}

	requireLibraryAccess(locals, media.library_id);

	if (media.media_type !== 'video') {
		error(400, 'HLS streaming is only available for video files');
	}

	const qualities = getAvailableQualities(media.width, media.height);

	if (qualities.length <= 1) {
		error(400, 'No transcode qualities available for this video');
	}

	const playlist = generateMasterPlaylist(mediaId, qualities, media.width, media.height);

	return new Response(playlist, {
		headers: {
			'Content-Type': 'application/vnd.apple.mpegurl',
			'Cache-Control': 'no-cache'
		}
	});
};
