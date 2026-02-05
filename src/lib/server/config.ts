import { join, resolve } from 'path';

/**
 * Get the configuration directory path based on environment
 */
export function getConfigDir(): string {
	return process.env.CONFIG_DIR || 
		(process.env.NODE_ENV === 'development' 
			? join(process.cwd(), 'test-config') 
			: '/config');
}

/**
 * Get the metadata directory path based on environment
 */
export function getMetadataDir(): string {
	return process.env.METADATA_DIR || 
		(process.env.NODE_ENV === 'development' 
			? join(process.cwd(), 'test-metadata') 
			: '/metadata');
}

/**
 * Get the media path based on environment
 */
export function getMediaPath(): string {
	return process.env.MEDIA_PATH || 
		(process.env.NODE_ENV === 'development' 
			? resolve(process.cwd(), 'test-media') 
			: '/media');
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
	return process.env.NODE_ENV === 'development';
}
