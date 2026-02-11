import { getDatabase } from '$lib/server/db';
import { FileScanner } from './file-scanner';
import { getLogger } from '$lib/server/logging';
import { getThumbnailGenerator } from '$lib/server/thumbnails';
import { probeMediaFile } from './probe';
import {
	invalidateTranscodeCache,
	invalidateRemuxCache,
	getStreamDecision,
	hasRemuxCache,
	startRemuxToCache,
	hasTranscodeCache,
	startTranscodeToCache,
	getAvailableQualities
} from '$lib/server/streaming';
import type { Library, Media } from '$lib/server/db';
import type { ScannedFile } from './file-scanner';
import { existsSync } from 'fs';

const logger = getLogger('library-scanner');

export interface ScanProgress {
	libraryId: number;
	totalFiles: number;
	processedFiles: number;
	addedFiles: number;
	updatedFiles: number;
	errors: number;
	thumbnailsGenerated?: number;
	filesProbed?: number;
	status: 'scanning' | 'processing' | 'completed' | 'failed';
}

export interface ScanStats {
	totalScanned: number;
	added: number;
	updated: number;
	removed: number;
	thumbnailsGenerated: number;
	filesProbed: number;
	errors: Array<{ path: string; error: string }>;
	duration: number;
}

export class LibraryScanner {
	private libraryId: number;
	private folderPath: string;

	constructor(library: Library) {
		this.libraryId = library.id;
		this.folderPath = library.folder_path;
	}

	async scan(onProgress?: (progress: ScanProgress) => void): Promise<ScanStats> {
		const startTime = Date.now();
		const stats: ScanStats = {
			totalScanned: 0,
			added: 0,
			updated: 0,
			removed: 0,
			thumbnailsGenerated: 0,
			filesProbed: 0,
			errors: [],
			duration: 0
		};

		logger.info(`Starting scan for library ${this.libraryId} at ${this.folderPath}`);

		try {
			const db = getDatabase();
			
			if (!existsSync(this.folderPath)) {
				const errorMessage = 'Library folder does not exist or is not accessible';
				
				try {
					db.prepare(`
						UPDATE library 
						SET path_status = 'missing', 
						    path_error = ?,
						    updated_at = datetime('now')
						WHERE id = ?
					`).run(errorMessage, this.libraryId);
				} catch (dbError) {
					if (dbError instanceof Error && dbError.message.includes('no such column')) {
						logger.warn(`Could not update library path_status (migration may not have run yet): ${dbError.message}`);
					} else {
						logger.error(`Failed to update library path_status: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
						throw dbError;
					}
				}
				
				stats.duration = Date.now() - startTime;
				stats.errors.push({ path: this.folderPath, error: errorMessage });
				
				logger.error(`Scan failed for library ${this.libraryId}: ${errorMessage}`);
				
				onProgress?.({
					libraryId: this.libraryId,
					totalFiles: 0,
					processedFiles: 0,
					addedFiles: 0,
					updatedFiles: 0,
					errors: 1,
					status: 'failed'
				});
				
				return stats;
			}
			
			try {
				db.prepare(`
					UPDATE library 
					SET path_status = 'ok', 
					    path_error = NULL,
					    updated_at = datetime('now')
				WHERE id = ?
				`).run(this.libraryId);
			} catch (dbError) {
				if (dbError instanceof Error && dbError.message.includes('no such column')) {
					logger.warn(`Could not update library path_status (migration may not have run yet): ${dbError.message}`);
				} else {
					logger.error(`Failed to update library path_status: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
					throw dbError;
				}
			}

			// Update progress: scanning
			onProgress?.({
				libraryId: this.libraryId,
				totalFiles: 0,
				processedFiles: 0,
				addedFiles: 0,
				updatedFiles: 0,
				errors: 0,
				status: 'scanning'
			});

			// Scan directory for media files
			const scanner = new FileScanner(this.folderPath);
			const scanResult = await scanner.scan({
				recursive: true,
				followSymlinks: false,
				maxDepth: 100,
				onError: (path, error) => {
					stats.errors.push({ path, error: error.message });
					logger.warn(`Scan error for ${path}: ${error.message}`);
				}
			});

			stats.totalScanned = scanResult.totalFiles;
			stats.errors.push(...scanResult.errors);

			logger.info(`Found ${scanResult.totalFiles} media files in library ${this.libraryId}`);

			// Update progress: processing
			onProgress?.({
				libraryId: this.libraryId,
				totalFiles: scanResult.totalFiles,
				processedFiles: 0,
				addedFiles: 0,
				updatedFiles: 0,
				errors: stats.errors.length,
				status: 'processing'
			});

			// Process scanned files and update database
			let processedCount = 0;

			for (const file of scanResult.files) {
				try {
					await this.processFile(file, stats);
					processedCount++;

					// Update progress periodically
					if (processedCount % 10 === 0 || processedCount === scanResult.totalFiles) {
						onProgress?.({
							libraryId: this.libraryId,
							totalFiles: scanResult.totalFiles,
							processedFiles: processedCount,
							addedFiles: stats.added,
							updatedFiles: stats.updated,
							thumbnailsGenerated: stats.thumbnailsGenerated,
							errors: stats.errors.length,
							status: 'processing'
						});
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					stats.errors.push({ path: file.path, error: errorMessage });
					logger.error(`Failed to process file ${file.path}`, error instanceof Error ? error : undefined);
				}
			}

			// Probe video files missing metadata
			await this.probeUnprobedMedia(stats, onProgress, scanResult.totalFiles);

			// Prepare video caches (remux/transcode) in the background
			this.prepareVideoCache();

			// Ensure all media has valid (non-placeholder) thumbnails
			await this.ensureThumbnails(stats, onProgress, scanResult.totalFiles);

			// Clean up orphaned media
			const orphanedCount = await this.cleanupOrphanedMedia();
			stats.removed = orphanedCount;

			stats.duration = Date.now() - startTime;

			logger.info(`Scan completed for library ${this.libraryId}: ${stats.added} added, ${stats.updated} updated, ${stats.removed} removed, ${stats.filesProbed} probed, ${stats.thumbnailsGenerated} thumbnails generated, ${stats.errors.length} errors in ${stats.duration}ms`);

			// Final progress update
			onProgress?.({
				libraryId: this.libraryId,
				totalFiles: scanResult.totalFiles,
				processedFiles: scanResult.totalFiles,
				addedFiles: stats.added,
				updatedFiles: stats.updated,
				errors: stats.errors.length,
				status: 'completed'
			});

			return stats;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error(`Scan failed for library ${this.libraryId}`, error instanceof Error ? error : undefined);
			
			stats.duration = Date.now() - startTime;
			stats.errors.push({ path: this.folderPath, error: errorMessage });

			onProgress?.({
				libraryId: this.libraryId,
				totalFiles: 0,
				processedFiles: 0,
				addedFiles: stats.added,
				updatedFiles: stats.updated,
				errors: stats.errors.length,
				status: 'failed'
			});

			throw error;
		}
	}

	private async processFile(file: ScannedFile, stats: ScanStats): Promise<void> {
		const db = getDatabase();

		// Check if file already exists in database
		const existing = db.prepare('SELECT id, size, mtime FROM media WHERE path = ? AND library_id = ?')
			.get(file.path, this.libraryId) as Media | undefined;

		const mtimeString = file.mtime.toISOString();
		const birthtimeString = file.birthtime.toISOString();

		if (existing) {
			// Check if file has been modified
			if (existing.size !== file.size || existing.mtime !== mtimeString) {
				if (file.mediaType === 'video') {
					const probe = await probeMediaFile(file.path);
					db.prepare(`
						UPDATE media 
						SET size = ?, mtime = ?, media_type = ?,
						    duration = ?, width = ?, height = ?,
						    video_codec = ?, audio_codec = ?,
						    container_format = ?, bitrate = ?,
						    updated_at = datetime('now')
						WHERE id = ?
					`).run(
						file.size, mtimeString, file.mediaType,
						probe.duration, probe.width, probe.height,
						probe.video_codec, probe.audio_codec,
						probe.container_format, probe.bitrate,
						existing.id
					);
					invalidateTranscodeCache(existing.id);
					invalidateRemuxCache(existing.id);
					stats.filesProbed++;
				} else {
					db.prepare(`
						UPDATE media 
						SET size = ?, mtime = ?, media_type = ?, updated_at = datetime('now')
						WHERE id = ?
					`).run(file.size, mtimeString, file.mediaType, existing.id);
				}
				
				stats.updated++;
				logger.debug(`Updated media file: ${file.path}`);
			}
		} else {
			if (file.mediaType === 'video') {
				const probe = await probeMediaFile(file.path);
				db.prepare(`
					INSERT INTO media (library_id, path, media_type, size, mtime, birthtime,
					    duration, width, height, video_codec, audio_codec, container_format, bitrate)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`).run(
					this.libraryId, file.path, file.mediaType, file.size, mtimeString, birthtimeString,
					probe.duration, probe.width, probe.height,
					probe.video_codec, probe.audio_codec,
					probe.container_format, probe.bitrate
				);
				stats.filesProbed++;
			} else {
				db.prepare(`
					INSERT INTO media (library_id, path, media_type, size, mtime, birthtime)
					VALUES (?, ?, ?, ?, ?, ?)
				`).run(this.libraryId, file.path, file.mediaType, file.size, mtimeString, birthtimeString);
			}
			
			stats.added++;
			logger.debug(`Added new media file: ${file.path}`);
		}
	}

	private async probeUnprobedMedia(
		stats: ScanStats,
		onProgress?: (progress: ScanProgress) => void,
		totalScannedFiles?: number
	): Promise<void> {
		const db = getDatabase();

		const unprobedMedia = db.prepare(
			'SELECT id, path, media_type FROM media WHERE library_id = ? AND media_type = ? AND video_codec IS NULL'
		).all(this.libraryId, 'video') as Array<{ id: number; path: string; media_type: string }>;

		const needingProbe = unprobedMedia.filter((media) => existsSync(media.path));

		if (needingProbe.length === 0) return;

		logger.info(`Probing ${needingProbe.length} video files in library ${this.libraryId}`);

		let processedCount = 0;

		for (const media of needingProbe) {
			try {
				const probe = await probeMediaFile(media.path);

				db.prepare(`
					UPDATE media 
					SET duration = ?, width = ?, height = ?,
					    video_codec = ?, audio_codec = ?,
					    container_format = ?, bitrate = ?,
					    updated_at = datetime('now')
					WHERE id = ?
				`).run(
					probe.duration, probe.width, probe.height,
					probe.video_codec, probe.audio_codec,
					probe.container_format, probe.bitrate,
					media.id
				);

				stats.filesProbed++;
				processedCount++;

				if (processedCount % 10 === 0) {
					onProgress?.({
						libraryId: this.libraryId,
						totalFiles: totalScannedFiles || needingProbe.length,
						processedFiles: totalScannedFiles || needingProbe.length,
						addedFiles: stats.added,
						updatedFiles: stats.updated,
						filesProbed: stats.filesProbed,
						errors: stats.errors.length,
						status: 'processing'
					});
				}
			} catch (error) {
				logger.warn(`Failed to probe ${media.path}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		if (stats.filesProbed > 0) {
			logger.info(`Probed ${stats.filesProbed} video files in library ${this.libraryId}`);
		}
	}

	private async ensureThumbnails(
		stats: ScanStats,
		onProgress?: (progress: ScanProgress) => void,
		totalScannedFiles?: number
	): Promise<void> {
		const db = getDatabase();
		const thumbnailGen = getThumbnailGenerator();

		const mediaFiles = db.prepare('SELECT id, path, media_type FROM media WHERE library_id = ?')
			.all(this.libraryId) as Array<{ id: number; path: string; media_type: string }>;

		const needingThumbnails = mediaFiles.filter((media) => {
			if (!existsSync(media.path)) return false;
			return !thumbnailGen.thumbnailExists(media.path);
		});

		if (needingThumbnails.length === 0) return;

		logger.info(`Generating thumbnails for ${needingThumbnails.length} media files in library ${this.libraryId}`);

		let processedCount = 0;

		for (const media of needingThumbnails) {
			try {
				await thumbnailGen.generateThumbnail(media.path, media.media_type as any);

				db.prepare('UPDATE media SET updated_at = datetime(\'now\') WHERE id = ?').run(media.id);
				stats.thumbnailsGenerated++;
				processedCount++;

				if (processedCount % 10 === 0) {
					onProgress?.({
						libraryId: this.libraryId,
						totalFiles: totalScannedFiles || mediaFiles.length,
						processedFiles: totalScannedFiles || mediaFiles.length,
						addedFiles: stats.added,
						updatedFiles: stats.updated,
						thumbnailsGenerated: stats.thumbnailsGenerated,
						errors: stats.errors.length,
						status: 'processing'
					});
				}
			} catch (error) {
				logger.warn(`Failed to generate thumbnail for ${media.path}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		if (stats.thumbnailsGenerated > 0) {
			logger.info(`Generated ${stats.thumbnailsGenerated} thumbnails for library ${this.libraryId}`);
		}
	}

	/**
	 * Kicks off background remux/transcode jobs for videos that need them.
	 * Runs after probing so all videos have codec metadata.
	 * Fire-and-forget — does not block the scan.
	 */
	private prepareVideoCache(): void {
		const db = getDatabase();

		const videos = db.prepare(
			'SELECT id, path, video_codec, audio_codec, container_format, width, height FROM media WHERE library_id = ? AND media_type = ? AND video_codec IS NOT NULL'
		).all(this.libraryId, 'video') as Array<{
			id: number; path: string;
			video_codec: string | null; audio_codec: string | null; container_format: string | null;
			width: number | null; height: number | null;
		}>;

		let remuxCount = 0;
		let transcodeCount = 0;

		for (const video of videos) {
			if (!existsSync(video.path)) continue;

			const decision = getStreamDecision(video.video_codec, video.audio_codec, video.container_format);

			if (decision.action === 'remux' && !hasRemuxCache(video.id)) {
				if (startRemuxToCache(video.path, video.id)) {
					remuxCount++;
				}
			}

			if (decision.action === 'transcode') {
				const qualities = getAvailableQualities(video.width, video.height);
				const bestQuality = qualities.find((q) => q !== 'original');
				if (bestQuality && !hasTranscodeCache(video.id, bestQuality)) {
					if (startTranscodeToCache(video.path, video.id, bestQuality)) {
						transcodeCount++;
					}
				}
			}
		}

		if (remuxCount > 0 || transcodeCount > 0) {
			logger.info(`Started background video cache: ${remuxCount} remux, ${transcodeCount} transcode jobs for library ${this.libraryId}`);
		}
	}

	private async cleanupOrphanedMedia(): Promise<number> {
		const db = getDatabase();
		const thumbnailGen = getThumbnailGenerator();

		// Get all media files for this library
		const mediaFiles = db.prepare('SELECT id, path FROM media WHERE library_id = ?')
			.all(this.libraryId) as Array<{ id: number; path: string }>;

		let removedCount = 0;

		for (const media of mediaFiles) {
			// Check if file still exists on disk
			if (!existsSync(media.path)) {
				// Delete thumbnail first
				try {
					await thumbnailGen.deleteThumbnail(media.path);
				} catch (error) {
					logger.warn(`Failed to delete thumbnail for ${media.path}: ${error instanceof Error ? error.message : String(error)}`);
				}

				// Clean up cached remux/transcode files
				invalidateRemuxCache(media.id);
				invalidateTranscodeCache(media.id);

				// Delete from database
				db.prepare('DELETE FROM media WHERE id = ?').run(media.id);
				removedCount++;
				logger.info(`Removed orphaned media: ${media.path}`);
			}
		}

		if (removedCount > 0) {
			logger.info(`Cleaned up ${removedCount} orphaned media files from library ${this.libraryId}`);
		}

		return removedCount;
	}
}

export async function scanLibrary(
	library: Library,
	onProgress?: (progress: ScanProgress) => void
): Promise<ScanStats> {
	const scanner = new LibraryScanner(library);
	return scanner.scan(onProgress);
}
