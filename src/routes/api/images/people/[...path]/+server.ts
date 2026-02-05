import { error } from '@sveltejs/kit';
import { resolve, join } from 'path';
import { existsSync, createReadStream } from 'fs';
import { getMetadataDir } from '$lib/server/config';
import type { RequestHandler } from './$types';
import { getLogger } from '$lib/server/logging';
import type { RequestEvent } from '@sveltejs/kit';

const logger = getLogger('api:person-image-serve');

export const GET = async ({ params }: RequestEvent) => {
	try {
		if (!params.path) {
			error(400, 'Invalid path');
		}

		const baseDir = resolve(getMetadataDir(), 'images', 'people');
		const imagePath = resolve(baseDir, params.path);

		if (!imagePath.startsWith(baseDir + '/') && imagePath !== baseDir) {
			logger.warn(`Path traversal attempt blocked: ${params.path}`);
			error(403, 'Access denied');
		}

		if (!existsSync(imagePath)) {
			error(404, 'Image not found');
		}

		const buffer = await readFile(imagePath);
		const ext = imagePath.split('.').pop()?.toLowerCase();

		let contentType = 'image/jpeg';
		if (ext === 'png') contentType = 'image/png';
		else if (ext === 'webp') contentType = 'image/webp';

		return new Response(buffer, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (err) {
		logger.error('Failed to serve person image', err instanceof Error ? err : undefined);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		error(500, 'Failed to load image');
	}
};
