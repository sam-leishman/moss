import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { existsSync, createReadStream, statSync } from 'fs';
import { extname } from 'path';
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

export const GET: RequestHandler = async ({ params, request }) => {
	const db = getDatabase();
	const mediaId = sanitizeInteger(params.id);

	const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId) as Media | undefined;

	if (!media) {
		error(404, 'Media not found');
	}

	if (!existsSync(media.path)) {
		error(404, 'Media file not found on disk');
	}

	const ext = extname(media.path).toLowerCase();
	const mimeType = (MIME_TYPES as Record<string, string>)[ext] || 'application/octet-stream';
	const stat = statSync(media.path);

	const range = request.headers.get('range');

	if (range && media.media_type === 'video') {
		const parts = range.replace(/bytes=/, '').split('-');
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

		if (isNaN(start) || isNaN(end) || start < 0 || end >= stat.size || start > end) {
			error(416, 'Range Not Satisfiable');
		}

		const chunkSize = end - start + 1;
		const stream = createReadStream(media.path, { start, end });

		stream.on('error', (err) => {
			console.error('Stream error:', err);
		});

		return new Response(stream as any, {
			status: 206,
			headers: {
				'Content-Range': `bytes ${start}-${end}/${stat.size}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': chunkSize.toString(),
				'Content-Type': mimeType
			}
		});
	}

	const stream = createReadStream(media.path);

	stream.on('error', (err) => {
		console.error('Stream error:', err);
	});

	return new Response(stream as any, {
		headers: {
			'Content-Type': mimeType,
			'Content-Length': stat.size.toString(),
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
