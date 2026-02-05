import { join } from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { getLogger } from '$lib/server/logging';
import { getMetadataDir } from '$lib/server/config';

const logger = getLogger('images:person');

export interface PersonImagePaths {
	imagePath: string;
	thumbnailPath: string;
}

export class PersonImageManager {
	private metadataDir: string;
	private imagesDir: string;
	private thumbnailsDir: string;

	constructor() {
		this.metadataDir = getMetadataDir();
		this.imagesDir = join(this.metadataDir, 'images', 'people');
		this.thumbnailsDir = join(this.imagesDir, 'thumbnails');
	}

	private async ensureDirectories(): Promise<void> {
		await mkdir(this.imagesDir, { recursive: true });
		await mkdir(this.thumbnailsDir, { recursive: true });
	}

	async savePersonImage(personId: number, imageBuffer: Buffer): Promise<PersonImagePaths> {
		await this.ensureDirectories();

		try {
			const image = sharp(imageBuffer);
			const metadata = await image.metadata();

			if (!metadata.width || !metadata.height) {
				throw new Error('Invalid image: unable to read dimensions');
			}

			const maxDimension = 1024;
			const needsResize = metadata.width > maxDimension || metadata.height > maxDimension;

			const imagePath = join(this.imagesDir, `${personId}.jpg`);
			const thumbnailPath = join(this.thumbnailsDir, `${personId}_thumb.jpg`);

			if (needsResize) {
				await image
					.resize(maxDimension, maxDimension, {
						fit: 'inside',
						withoutEnlargement: true
					})
					.jpeg({ quality: 90 })
					.toFile(imagePath);
			} else {
				await image
					.jpeg({ quality: 90 })
					.toFile(imagePath);
			}

			await sharp(imageBuffer)
				.resize(200, 200, { fit: 'cover' })
				.jpeg({ quality: 80 })
				.toFile(thumbnailPath);

			logger.info(`Saved image for person ${personId}`);

			return {
				imagePath: `${personId}.jpg`,
				thumbnailPath: `thumbnails/${personId}_thumb.jpg`
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to save image for person ${personId}: ${errorMessage}`);
			throw new Error(`Failed to process image: ${errorMessage}`);
		}
	}

	async deletePersonImage(personId: number): Promise<void> {
		const imagePath = join(this.imagesDir, `${personId}.jpg`);
		const thumbnailPath = join(this.thumbnailsDir, `${personId}_thumb.jpg`);

		try {
			if (existsSync(imagePath)) {
				await unlink(imagePath);
				logger.info(`Deleted image for person ${personId}`);
			}

			if (existsSync(thumbnailPath)) {
				await unlink(thumbnailPath);
				logger.info(`Deleted thumbnail for person ${personId}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to delete image for person ${personId}: ${errorMessage}`);
			throw error;
		}
	}

	getImagePath(personId: number): string {
		return join(this.imagesDir, `${personId}.jpg`);
	}

	getThumbnailPath(personId: number): string {
		return join(this.thumbnailsDir, `${personId}_thumb.jpg`);
	}

	imageExists(personId: number): boolean {
		return existsSync(this.getImagePath(personId));
	}
}

let personImageManager: PersonImageManager | null = null;

export function getPersonImageManager(): PersonImageManager {
	if (!personImageManager) {
		personImageManager = new PersonImageManager();
	}
	return personImageManager;
}
