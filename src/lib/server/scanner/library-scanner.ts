import { getDatabase } from '$lib/server/db';
import { FileScanner } from './file-scanner';
import { getLogger } from '$lib/server/logging';
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
	status: 'scanning' | 'processing' | 'completed' | 'failed';
}

export interface ScanStats {
	totalScanned: number;
	added: number;
	updated: number;
	removed: number;
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
			errors: [],
			duration: 0
		};

		logger.info(`Starting scan for library ${this.libraryId} at ${this.folderPath}`);

		try {
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
			const db = getDatabase();
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

			// Clean up orphaned media
			const orphanedCount = await this.cleanupOrphanedMedia();
			stats.removed = orphanedCount;

			stats.duration = Date.now() - startTime;

			logger.info(`Scan completed for library ${this.libraryId}: ${stats.added} added, ${stats.updated} updated, ${stats.removed} removed, ${stats.errors.length} errors in ${stats.duration}ms`);

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

		if (existing) {
			// Check if file has been modified
			if (existing.size !== file.size || existing.mtime !== mtimeString) {
				db.prepare(`
					UPDATE media 
					SET size = ?, mtime = ?, media_type = ?, updated_at = datetime('now')
					WHERE id = ?
				`).run(file.size, mtimeString, file.mediaType, existing.id);
				
				stats.updated++;
				logger.debug(`Updated media file: ${file.path}`);
			}
		} else {
			// Insert new media file
			db.prepare(`
				INSERT INTO media (library_id, path, media_type, size, mtime)
				VALUES (?, ?, ?, ?, ?)
			`).run(this.libraryId, file.path, file.mediaType, file.size, mtimeString);
			
			stats.added++;
			logger.debug(`Added new media file: ${file.path}`);
		}
	}

	private async cleanupOrphanedMedia(): Promise<number> {
		const db = getDatabase();

		// Get all media files for this library
		const mediaFiles = db.prepare('SELECT id, path FROM media WHERE library_id = ?')
			.all(this.libraryId) as Array<{ id: number; path: string }>;

		let removedCount = 0;

		for (const media of mediaFiles) {
			// Check if file still exists on disk
			if (!existsSync(media.path)) {
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

export async function cleanupOrphanedMediaForLibrary(libraryId: number): Promise<number> {
	const db = getDatabase();
	const library = db.prepare('SELECT * FROM library WHERE id = ?').get(libraryId) as Library | undefined;

	if (!library) {
		throw new Error(`Library ${libraryId} not found`);
	}

	const scanner = new LibraryScanner(library);
	return scanner['cleanupOrphanedMedia']();
}
