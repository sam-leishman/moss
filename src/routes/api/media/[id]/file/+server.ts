import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { requireLibraryAccess } from '$lib/server/auth';
import {
	getStreamDecision,
	getAvailableQualities,
	createRemuxStream,
	hasRemuxCache,
	startRemuxToCache,
	getRemuxCachePath,
	createTranscodeStream,
	hasTranscodeCache,
	canStartTranscode,
	getTranscodeCachePath,
	startTranscodeToCache
} from '$lib/server/streaming';
import type { QualityPreset } from '$lib/server/streaming';
import { existsSync, createReadStream, statSync } from 'fs';
import { extname } from 'path';
import type { Readable } from 'stream';
import type { ChildProcess } from 'child_process';
import type { RequestHandler } from './$types';

const MIME_TYPES = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
	'.tiff': 'image/tiff',
	'.tif': 'image/tiff',
	'.svg': 'image/svg+xml',
	'.gif': 'image/gif',
	'.apng': 'image/apng',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.mkv': 'video/x-matroska',
	'.avi': 'video/x-msvideo',
	'.mov': 'video/quicktime'
} as const;

const VALID_QUALITIES = new Set<QualityPreset>(['original', 'high', 'medium', 'low']);

/**
 * Wraps a Node.js Readable stream into a web ReadableStream suitable for
 * use as a Response body. Handles cancellation cleanly — when the client
 * disconnects, the optional childProcess is killed and the Node stream
 * is destroyed without crashing the server.
 */
function nodeStreamToWeb(nodeStream: Readable, childProcess?: ChildProcess): ReadableStream<Uint8Array> {
	let destroyed = false;

	const cleanup = () => {
		if (destroyed) return;
		destroyed = true;
		if (childProcess && !childProcess.killed) {
			childProcess.kill('SIGKILL');
		}
		if (!nodeStream.destroyed) {
			nodeStream.destroy();
		}
	};

	return new ReadableStream({
		start(controller) {
			nodeStream.on('data', (chunk: Buffer) => {
				if (destroyed) return;
				try {
					controller.enqueue(new Uint8Array(chunk));
				} catch {
					// Controller already closed — client disconnected
					cleanup();
				}
			});

			nodeStream.on('end', () => {
				if (destroyed) return;
				try {
					controller.close();
				} catch {
					// Already closed
				}
			});

			nodeStream.on('error', (err) => {
				if (destroyed) return;
				try {
					controller.error(err);
				} catch {
					// Already closed
				}
				cleanup();
			});
		},
		cancel() {
			cleanup();
		}
	});
}

export const GET: RequestHandler = async ({ params, request, locals, url }) => {
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

	// Parse quality parameter
	const qualityParam = url.searchParams.get('quality') as QualityPreset | null;
	const quality: QualityPreset = qualityParam && VALID_QUALITIES.has(qualityParam) ? qualityParam : 'original';

	// For video files, determine streaming strategy
	if (media.media_type === 'video') {
		const decision = getStreamDecision(media.video_codec, media.audio_codec, media.container_format);

		// Explicit quality downgrade requested — transcode regardless of codec compatibility
		if (quality !== 'original') {
			return await serveTranscoded(media, quality, request);
		}

		if (decision.action === 'remux') {
			// Compatible codecs but wrong container (e.g. MKV, AVI).
			// Serve cached remux MP4 with Range support for full seeking.
			if (hasRemuxCache(media.id)) {
				return serveRawFile(getRemuxCachePath(media.id), 'video', request);
			}

			// Start background remux to cache for next time
			startRemuxToCache(media.path, media.id);

			// Stream via ffmpeg pipe while cache is being built
			const { stream, process: ffmpeg } = createRemuxStream(media.path);
			return new Response(nodeStreamToWeb(stream, ffmpeg), {
				headers: {
					'Content-Type': 'video/mp4',
					'Cache-Control': 'no-cache'
				}
			});
		}

		if (decision.action === 'transcode') {
			// Incompatible codec — transcode to H.264/AAC.
			// Pick the highest available transcode quality for the source resolution.
			const qualities = getAvailableQualities(media.width, media.height);
			const bestQuality = qualities.find((q) => q !== 'original') || 'low';
			return await serveTranscoded(media, bestQuality, request);
		}
	}

	// Direct serve: images or non-video content
	return serveRawFile(media.path, media.media_type, request);
};

async function serveTranscoded(media: Media, quality: QualityPreset, request: Request): Promise<Response> {
	// Serve from cache with full Range support for seeking
	if (hasTranscodeCache(media.id, quality)) {
		return serveRawFile(getTranscodeCachePath(media.id, quality), 'video', request);
	}

	// Start background transcode if not already running
	startTranscodeToCache(media.path, media.id, quality);

	// Stream via ffmpeg pipe for immediate playback (no seeking).
	// Wait briefly for a transcode slot to free up (handles race with abort cleanup)
	const maxRetries = 10;
	for (let i = 0; i < maxRetries && !canStartTranscode(); i++) {
		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	if (!canStartTranscode()) {
		error(503, 'Transcoding queue is full. Please try again shortly.');
	}

	const result = createTranscodeStream(media.path, media.id, quality);

	if (!result) {
		error(500, 'Failed to start transcode');
	}

	return new Response(nodeStreamToWeb(result.stream, result.process), {
		headers: {
			'Content-Type': 'video/mp4',
			'Cache-Control': 'no-cache'
		}
	});
}

function serveRawFile(filePath: string, mediaType: string, request: Request): Response {
	const ext = extname(filePath).toLowerCase();
	const mimeType = (MIME_TYPES as Record<string, string>)[ext] || 'application/octet-stream';
	const stat = statSync(filePath);

	const range = request.headers.get('range');

	if (range && mediaType === 'video') {
		const parts = range.replace(/bytes=/, '').split('-');
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

		if (isNaN(start) || isNaN(end) || start < 0 || end >= stat.size || start > end) {
			error(416, 'Range Not Satisfiable');
		}

		const chunkSize = end - start + 1;
		const stream = createReadStream(filePath, { start, end });

		return new Response(nodeStreamToWeb(stream), {
			status: 206,
			headers: {
				'Content-Range': `bytes ${start}-${end}/${stat.size}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': chunkSize.toString(),
				'Content-Type': mimeType
			}
		});
	}

	const stream = createReadStream(filePath);

	return new Response(nodeStreamToWeb(stream), {
		headers: {
			'Content-Type': mimeType,
			'Content-Length': stat.size.toString(),
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
}
