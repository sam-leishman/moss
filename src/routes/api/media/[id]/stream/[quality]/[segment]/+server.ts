import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import { getHlsSegment, requestHlsSegment } from '$lib/server/streaming';
import type { QualityPreset } from '$lib/server/streaming';
import { existsSync } from 'fs';
import type { RequestHandler } from './$types';

const VALID_QUALITIES = new Set<QualityPreset>(['high', 'medium', 'low']);
const SEGMENT_PATTERN = /^segment-(\d{3})\.ts$/;

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);
	const quality = params.quality as QualityPreset;
	const segment = params.segment;

	const segmentMatch = SEGMENT_PATTERN.exec(segment);
	if (!segmentMatch) {
		error(400, 'Invalid segment name');
	}

	if (!VALID_QUALITIES.has(quality)) {
		error(400, 'Invalid quality preset');
	}

	const segmentIndex = parseInt(segmentMatch[1], 10);
	
	console.log(`[SEGMENT REQUEST] media=${mediaId}, quality=${quality}, segment=${segmentIndex}`);

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

	// Request the segment — generates on-demand if not cached
	const ready = await requestHlsSegment(media.path, mediaId, quality, segmentIndex);

	if (!ready) {
		error(503, 'Segment generation timed out or failed. Please try again.');
	}

	const segmentData = getHlsSegment(mediaId, quality, segment);

	if (!segmentData) {
		error(500, 'Segment was reported ready but could not be read');
	}

	return new Response(new Uint8Array(segmentData), {
		headers: {
			'Content-Type': 'video/mp2t',
			'Content-Length': segmentData.length.toString(),
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
