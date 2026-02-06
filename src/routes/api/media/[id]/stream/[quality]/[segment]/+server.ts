import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import { getHlsSegment, hasHlsCache } from '$lib/server/streaming';
import type { QualityPreset } from '$lib/server/streaming';
import type { RequestHandler } from './$types';

const VALID_QUALITIES = new Set<QualityPreset>(['high', 'medium', 'low']);
const SEGMENT_PATTERN = /^segment-\d{3}\.ts$/;

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);
	const quality = params.quality as QualityPreset;
	const segment = params.segment;

	if (!VALID_QUALITIES.has(quality)) {
		error(400, 'Invalid quality preset');
	}

	if (!SEGMENT_PATTERN.test(segment)) {
		error(400, 'Invalid segment name');
	}

	const media = db.prepare('SELECT id, library_id, media_type FROM media WHERE id = ?').get(mediaId) as Media | undefined;

	if (!media) {
		error(404, 'Media not found');
	}

	requireLibraryAccess(locals, media.library_id);

	if (media.media_type !== 'video') {
		error(400, 'HLS streaming is only available for video files');
	}

	const segmentData = getHlsSegment(mediaId, quality, segment);

	if (!segmentData) {
		error(404, 'Segment not found. It may still be generating.');
	}

	const isComplete = hasHlsCache(mediaId, quality);

	return new Response(new Uint8Array(segmentData), {
		headers: {
			'Content-Type': 'video/mp2t',
			'Content-Length': segmentData.length.toString(),
			'Cache-Control': isComplete ? 'public, max-age=31536000, immutable' : 'no-cache'
		}
	});
};
