import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import { generateVodPlaylist, pregenerateInitialSegments } from '$lib/server/streaming';
import type { QualityPreset } from '$lib/server/streaming';
import { existsSync } from 'fs';
import type { RequestHandler } from './$types';

const VALID_QUALITIES = new Set<QualityPreset>(['high', 'medium', 'low']);

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);
	const quality = params.quality as QualityPreset;

	if (!VALID_QUALITIES.has(quality)) {
		error(400, 'Invalid quality preset');
	}

	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as Media | undefined;

	if (!media) {
		error(404, 'Media not found');
	}

	requireLibraryAccess(locals, media.library_id);

	if (media.media_type !== 'video') {
		error(400, 'HLS streaming is only available for video files');
	}

	if (!media.duration) {
		error(400, 'Video duration is unknown — cannot generate HLS playlist');
	}

	if (!existsSync(media.path)) {
		error(404, 'Media file not found on disk');
	}

	// Pre-generate the first 3 segments to ensure smooth playback start
	// This also starts background encoding for the rest of the video
	const ready = await pregenerateInitialSegments(media.path, mediaId, quality, 3);
	
	if (!ready) {
		error(503, 'Failed to generate initial segments. Please try again.');
	}

	// Generate a complete VOD playlist using the known duration.
	// Now that initial segments exist, hls.js can start playback immediately
	// and seeking will work properly as segments are generated on-demand.
	const playlist = generateVodPlaylist(mediaId, quality, media.duration);

	return new Response(playlist, {
		headers: {
			'Content-Type': 'application/vnd.apple.mpegurl',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
