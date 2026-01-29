import { readdirSync, statSync, lstatSync, type Stats } from 'fs';
import { join, relative } from 'path';
import { validateMediaPath } from '$lib/server/security';
import { detectMediaType, isSupportedMediaFile } from './media-detector';
import type { MediaType } from '$lib/server/security';

export interface ScannedFile {
	path: string;
	relativePath: string;
	mediaType: MediaType;
	size: number;
	mtime: Date;
}

export interface ScanOptions {
	recursive?: boolean;
	followSymlinks?: boolean;
	maxDepth?: number;
	onProgress?: (file: ScannedFile) => void;
	onError?: (path: string, error: Error) => void;
}

export interface ScanResult {
	files: ScannedFile[];
	totalFiles: number;
	totalSize: number;
	errors: Array<{ path: string; error: string }>;
	scannedDirectories: number;
}

export class FileScanner {
	private rootPath: string;
	private scannedFiles: ScannedFile[] = [];
	private errors: Array<{ path: string; error: string }> = [];
	private totalSize = 0;
	private scannedDirectories = 0;

	constructor(rootPath: string) {
		this.rootPath = validateMediaPath(rootPath, { mustExist: true });
	}

	async scan(options: ScanOptions = {}): Promise<ScanResult> {
		const {
			recursive = true,
			followSymlinks = false,
			maxDepth = 100,
			onProgress,
			onError
		} = options;

		this.scannedFiles = [];
		this.errors = [];
		this.totalSize = 0;
		this.scannedDirectories = 0;

		await this.scanDirectory(this.rootPath, 0, maxDepth, recursive, followSymlinks, onProgress, onError);

		return {
			files: this.scannedFiles,
			totalFiles: this.scannedFiles.length,
			totalSize: this.totalSize,
			errors: this.errors,
			scannedDirectories: this.scannedDirectories
		};
	}

	private async scanDirectory(
		dirPath: string,
		currentDepth: number,
		maxDepth: number,
		recursive: boolean,
		followSymlinks: boolean,
		onProgress?: (file: ScannedFile) => void,
		onError?: (path: string, error: Error) => void
	): Promise<void> {
		if (currentDepth > maxDepth) {
			return;
		}

		this.scannedDirectories++;

		let entries: string[];
		try {
			entries = readdirSync(dirPath);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.errors.push({ path: dirPath, error: errorMessage });
			if (onError) {
				onError(dirPath, error instanceof Error ? error : new Error(errorMessage));
			}
			return;
		}

		for (const entry of entries) {
			const fullPath = join(dirPath, entry);

			let stats: Stats;
			try {
				stats = lstatSync(fullPath);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				this.errors.push({ path: fullPath, error: errorMessage });
				if (onError) {
					onError(fullPath, error instanceof Error ? error : new Error(errorMessage));
				}
				continue;
			}

			if (stats.isSymbolicLink()) {
				if (!followSymlinks) {
					continue;
				}
				
				try {
					stats = statSync(fullPath);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					this.errors.push({ path: fullPath, error: errorMessage });
					if (onError) {
						onError(fullPath, error instanceof Error ? error : new Error(errorMessage));
					}
					continue;
				}
			}

			if (stats.isDirectory()) {
				if (recursive) {
					await this.scanDirectory(
						fullPath,
						currentDepth + 1,
						maxDepth,
						recursive,
						followSymlinks,
						onProgress,
						onError
					);
				}
			} else if (stats.isFile()) {
				if (isSupportedMediaFile(fullPath)) {
					const mediaType = detectMediaType(fullPath);
					if (mediaType) {
						const scannedFile: ScannedFile = {
							path: fullPath,
							relativePath: relative(this.rootPath, fullPath),
							mediaType,
							size: stats.size,
							mtime: stats.mtime
						};

						this.scannedFiles.push(scannedFile);
						this.totalSize += stats.size;

						if (onProgress) {
							onProgress(scannedFile);
						}
					}
				}
			}
		}
	}

	getRootPath(): string {
		return this.rootPath;
	}
}

export async function scanDirectory(
	rootPath: string,
	options?: ScanOptions
): Promise<ScanResult> {
	const scanner = new FileScanner(rootPath);
	return scanner.scan(options);
}

export async function scanDirectoryQuick(rootPath: string): Promise<ScannedFile[]> {
	const result = await scanDirectory(rootPath, {
		recursive: true,
		followSymlinks: false,
		maxDepth: 100
	});
	return result.files;
}
