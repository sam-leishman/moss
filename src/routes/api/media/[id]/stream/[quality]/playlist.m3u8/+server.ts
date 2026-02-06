import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import {
	getHlsPlaylist,
	hasHlsCache,
	isHlsGenerating,
	startHlsGeneration
} from '$lib/server/streaming';
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

	if (!existsSync(media.path)) {
		error(404, 'Media file not found on disk');
	}

	// If not cached and not generating, start generation
	if (!hasHlsCache(mediaId, quality) && !isHlsGenerating(mediaId, quality)) {
		const started = startHlsGeneration(media.path, mediaId, quality);
		if (!started) {
			error(503, 'Transcoding queue is full. Please try again shortly.');
		}
	}

	// Try to return the playlist (may be partial if still generating)
	const playlist = getHlsPlaylist(mediaId, quality);

	if (!playlist) {
		// Playlist not yet written — generation just started, tell client to retry
		return new Response('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n', {
			headers: {
				'Content-Type': 'application/vnd.apple.mpegurl',
				'Cache-Control': 'no-cache',
				'Retry-After': '2'
			}
		});
	}

	const isComplete = playlist.includes('#EXT-X-ENDLIST');

	return new Response(playlist, {
		headers: {
			'Content-Type': 'application/vnd.apple.mpegurl',
			'Cache-Control': isComplete ? 'public, max-age=31536000, immutable' : 'no-cache'
		}
	});
};
