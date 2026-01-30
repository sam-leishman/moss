import sharp from 'sharp';
import { join, dirname, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import type { MediaType } from '$lib/server/security';
import { getLogger } from '$lib/server/logging';

const logger = getLogger();

export interface ThumbnailOptions {
	width?: number;
	height?: number;
	quality?: number;
	fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export const DEFAULT_THUMBNAIL_OPTIONS: Required<ThumbnailOptions> = {
	width: 300,
	height: 300,
	quality: 80,
	fit: 'cover'
};

export class ThumbnailGenerator {
	private metadataDir: string;
	private thumbnailsDir: string;

	constructor() {
		this.metadataDir = process.env.METADATA_DIR || join(process.cwd(), 'test-metadata');
		this.thumbnailsDir = join(this.metadataDir, 'thumbnails');
		this.ensureDirectories();
	}

	private ensureDirectories(): void {
		if (!existsSync(this.metadataDir)) {
			mkdirSync(this.metadataDir, { recursive: true });
		}
		if (!existsSync(this.thumbnailsDir)) {
			mkdirSync(this.thumbnailsDir, { recursive: true });
		}
	}

	private getHashedPath(mediaPath: string): string {
		const hash = createHash('sha256').update(mediaPath).digest('hex');
		const subdir = hash.substring(0, 2);
		return join(this.thumbnailsDir, subdir, `${hash}.webp`);
	}

	async generateThumbnail(
		mediaPath: string,
		mediaType: MediaType,
		options: ThumbnailOptions = {}
	): Promise<string> {
		const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };
		const thumbnailPath = this.getHashedPath(mediaPath);

		if (existsSync(thumbnailPath)) {
			return thumbnailPath;
		}

		const thumbnailDir = dirname(thumbnailPath);
		if (!existsSync(thumbnailDir)) {
			mkdirSync(thumbnailDir, { recursive: true });
		}

		try {
			if (mediaType === 'image' || mediaType === 'animated') {
				await this.generateImageThumbnail(mediaPath, thumbnailPath, opts);
			} else if (mediaType === 'video') {
				await this.generateVideoThumbnail(mediaPath, thumbnailPath, opts);
			} else {
				throw new Error(`Unsupported media type: ${mediaType}`);
			}

			return thumbnailPath;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to generate thumbnail for ${mediaPath}: ${errorMessage}`);
			throw error;
		}
	}

	private async generateImageThumbnail(
		sourcePath: string,
		thumbnailPath: string,
		options: Required<ThumbnailOptions>
	): Promise<void> {
		await sharp(sourcePath)
			.resize(options.width, options.height, {
				fit: options.fit,
				withoutEnlargement: true
			})
			.webp({ quality: options.quality })
			.toFile(thumbnailPath);
	}

	private async generateVideoThumbnail(
		sourcePath: string,
		thumbnailPath: string,
		options: Required<ThumbnailOptions>
	): Promise<void> {
		const { spawn } = await import('child_process');
		const tempPngPath = thumbnailPath.replace('.webp', '.png');

		try {
			await new Promise<void>((resolve, reject) => {
				const ffmpeg = spawn('ffmpeg', [
					'-i', sourcePath,
					'-vf', 'select=eq(n\\,0)',
					'-vframes', '1',
					'-y',
					tempPngPath
				], { timeout: 10000 });

				let errorOutput = '';
				ffmpeg.stderr.on('data', (data) => {
					errorOutput += data.toString();
				});

				ffmpeg.on('close', (code) => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`));
					}
				});

				ffmpeg.on('error', (err) => {
					reject(err);
				});
			});

			await sharp(tempPngPath)
				.resize(options.width, options.height, {
					fit: options.fit,
					withoutEnlargement: true
				})
				.webp({ quality: options.quality })
				.toFile(thumbnailPath);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.warn(`FFmpeg not available for ${sourcePath}, using placeholder: ${errorMessage}`);
			await this.generatePlaceholderThumbnail(thumbnailPath, options, 'video');
		} finally {
			const { unlinkSync } = await import('fs');
			if (existsSync(tempPngPath)) {
				try {
					unlinkSync(tempPngPath);
				} catch (err) {
					logger.warn(`Failed to cleanup temp file ${tempPngPath}`);
				}
			}
		}
	}

	private async generatePlaceholderThumbnail(
		thumbnailPath: string,
		options: Required<ThumbnailOptions>,
		type: string
	): Promise<void> {
		const svg = `
			<svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">
				<rect width="100%" height="100%" fill="#e5e7eb"/>
				<text x="50%" y="50%" font-family="Arial" font-size="16" fill="#6b7280" text-anchor="middle" dominant-baseline="middle">
					${type.toUpperCase()}
				</text>
			</svg>
		`;

		await sharp(Buffer.from(svg))
			.webp({ quality: options.quality })
			.toFile(thumbnailPath);
	}

	getThumbnailPath(mediaPath: string): string {
		return this.getHashedPath(mediaPath);
	}

	thumbnailExists(mediaPath: string): boolean {
		return existsSync(this.getHashedPath(mediaPath));
	}

	private async removeEmptyDirectory(dirPath: string): Promise<void> {
		const { readdirSync, rmdirSync } = await import('fs');
		
		// Don't remove the root thumbnails directory
		if (dirPath === this.thumbnailsDir) {
			return;
		}
		
		try {
			const entries = readdirSync(dirPath);
			if (entries.length === 0) {
				rmdirSync(dirPath);
				logger.debug(`Removed empty directory: ${dirPath}`);
			}
		} catch (error) {
			// Directory doesn't exist or can't be read, ignore
		}
	}

	async deleteThumbnail(mediaPath: string): Promise<void> {
		const thumbnailPath = this.getHashedPath(mediaPath);
		if (existsSync(thumbnailPath)) {
			const { unlinkSync } = await import('fs');
			unlinkSync(thumbnailPath);
			logger.info(`Deleted thumbnail for ${mediaPath}`);
			
			// Clean up empty parent directory
			const parentDir = dirname(thumbnailPath);
			await this.removeEmptyDirectory(parentDir);
		}
	}

	async cleanupOrphanedThumbnails(validMediaPaths: Set<string>): Promise<number> {
		const { readdirSync, statSync, unlinkSync } = await import('fs');
		let deletedCount = 0;
		const emptyDirs: string[] = [];

		const processDirectory = (dir: string) => {
			if (!existsSync(dir)) return;

			const entries = readdirSync(dir);
			let hasFiles = false;

			for (const entry of entries) {
				const fullPath = join(dir, entry);
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					processDirectory(fullPath);
				} else if (entry.endsWith('.webp')) {
					const isOrphaned = !Array.from(validMediaPaths).some(
						(mediaPath) => this.getHashedPath(mediaPath) === fullPath
					);

					if (isOrphaned) {
						unlinkSync(fullPath);
						deletedCount++;
					} else {
						hasFiles = true;
					}
				}
			}

			// Mark directory for cleanup if it's empty and not the root
			if (!hasFiles && dir !== this.thumbnailsDir) {
				emptyDirs.push(dir);
			}
		};

		processDirectory(this.thumbnailsDir);

		// Clean up empty directories
		for (const dir of emptyDirs) {
			await this.removeEmptyDirectory(dir);
		}

		logger.info(`Cleaned up ${deletedCount} orphaned thumbnails`);
		return deletedCount;
	}
}

let thumbnailGenerator: ThumbnailGenerator | null = null;

export function getThumbnailGenerator(): ThumbnailGenerator {
	if (!thumbnailGenerator) {
		thumbnailGenerator = new ThumbnailGenerator();
	}
	return thumbnailGenerator;
}
