import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import { getStreamDecision, getAvailableQualities, hasTranscodeCache, hasRemuxCache } from '$lib/server/streaming';
import type { QualityPreset } from '$lib/server/streaming';
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
	const needsTranscode = decision.action === 'transcode';

	// Get available quality presets based on source resolution
	const allQualities = getAvailableQualities(media.width, media.height);

	// When transcoding is required (incompatible codec), exclude 'original' since
	// the browser can't play the source codec natively (e.g. HEVC).
	const qualities = needsTranscode
		? allQualities.filter((q) => q !== 'original')
		: allQualities;

	// Determine if seeking is available for each quality.
	// Seeking requires a completed file on disk (direct serve, cached remux, or cached transcode).
	const cached: Record<string, boolean> = {};
	for (const q of qualities) {
		if (q === 'original') {
			// Original is seekable if direct-serve or remux cache is ready
			cached[q] = decision.action === 'direct' || hasRemuxCache(mediaId);
		} else {
			cached[q] = hasTranscodeCache(mediaId, q as QualityPreset);
		}
	}

	return json({
		qualities,
		needsTranscode,
		cached,
		sourceCodec: media.video_codec,
		sourceResolution: media.width && media.height ? `${media.width}x${media.height}` : null
	});
};
