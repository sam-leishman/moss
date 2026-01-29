import { extname } from 'path';
import type { MediaType } from '$lib/server/security';

export interface SupportedFormats {
	image: readonly string[];
	video: readonly string[];
	animated: readonly string[];
}

export const SUPPORTED_FORMATS: SupportedFormats = {
	image: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.svg'],
	video: ['.mp4', '.webm', '.mkv', '.avi', '.mov'],
	animated: ['.gif', '.apng']
} as const;

const ALL_SUPPORTED_EXTENSIONS = new Set([
	...SUPPORTED_FORMATS.image,
	...SUPPORTED_FORMATS.video,
	...SUPPORTED_FORMATS.animated
]);

export function detectMediaType(filePath: string): MediaType | null {
	const ext = extname(filePath).toLowerCase();
	
	if (!ext) {
		return null;
	}
	
	if ((SUPPORTED_FORMATS.image as readonly string[]).includes(ext)) {
		return 'image';
	}
	
	if ((SUPPORTED_FORMATS.video as readonly string[]).includes(ext)) {
		return 'video';
	}
	
	if ((SUPPORTED_FORMATS.animated as readonly string[]).includes(ext)) {
		return 'animated';
	}
	
	return null;
}

export function isSupportedMediaFile(filePath: string): boolean {
	const ext = extname(filePath).toLowerCase();
	return ALL_SUPPORTED_EXTENSIONS.has(ext);
}

export function getSupportedExtensions(): string[] {
	return Array.from(ALL_SUPPORTED_EXTENSIONS);
}

export function getExtensionsByType(type: MediaType): readonly string[] {
	return SUPPORTED_FORMATS[type];
}
