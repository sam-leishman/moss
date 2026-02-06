import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import { getStreamDecision, getAvailableQualities } from '$lib/server/streaming';
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
		return json({ qualities: [] });
	}

	const decision = getStreamDecision(media.video_codec, media.audio_codec, media.container_format);
	const needsTranscode = decision.action === 'transcode' || decision.action === 'remux';

	// Get available quality presets based on source resolution
	const qualities = getAvailableQualities(media.width, media.height);

	// HLS is available when there are transcode-able qualities (not just 'original')
	const hasHls = qualities.length > 1;

	return json({
		qualities,
		needsTranscode,
		hlsUrl: hasHls ? `/api/media/${mediaId}/stream/master.m3u8` : null,
		sourceCodec: media.video_codec,
		sourceResolution: media.width && media.height ? `${media.width}x${media.height}` : null
	});
};
