import { realpathSync, existsSync, statSync } from 'fs';
import { resolve, normalize, isAbsolute, sep } from 'path';
import { getMediaPath } from '$lib/server/config';

export class PathValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PathValidationError';
	}
}

export interface PathValidationOptions {
	allowedRoot: string;
	mustExist?: boolean;
	allowSymlinks?: boolean;
}

export class PathValidator {
	private allowedRoot: string;

	constructor(allowedRoot: string) {
		if (!allowedRoot) {
			throw new Error('allowedRoot must be provided');
		}

		if (!isAbsolute(allowedRoot)) {
			throw new Error('allowedRoot must be an absolute path');
		}

		try {
			this.allowedRoot = realpathSync(allowedRoot);
		} catch (error) {
			throw new Error(`allowedRoot does not exist or is not accessible: ${allowedRoot}`);
		}
	}

	validatePath(inputPath: string, options: Partial<PathValidationOptions> = {}): string {
		const { mustExist = true, allowSymlinks = false } = options;

		if (!inputPath) {
			throw new PathValidationError('Path cannot be empty');
		}

		if (inputPath.includes('\0')) {
			throw new PathValidationError('Path contains null bytes');
		}

		// Handle /media-prefixed paths by stripping the prefix
		// This allows frontend to use Docker-style paths like /media/subfolder
		// while backend resolves them relative to the actual media root
		let processedPath = inputPath;
		if (inputPath.startsWith('/media/')) {
			processedPath = inputPath.substring(7); // Remove '/media/'
		} else if (inputPath === '/media') {
			processedPath = ''; // Root of media directory
		}

		let normalizedPath = normalize(processedPath || '.');

		// Always resolve relative to allowed root since we've stripped /media prefix
		if (!isAbsolute(normalizedPath)) {
			normalizedPath = resolve(this.allowedRoot, normalizedPath);
		} else if (processedPath !== inputPath) {
			// If we stripped /media prefix, ensure we resolve relative to root
			normalizedPath = resolve(this.allowedRoot, normalizedPath);
		}

		if (mustExist && !existsSync(normalizedPath)) {
			throw new PathValidationError('Path does not exist');
		}

		let resolvedPath: string;
		try {
			if (mustExist) {
				resolvedPath = realpathSync(normalizedPath);
			} else {
				const parts = normalizedPath.split(sep);
				let current = parts[0] || sep;
				const resolvedParts: string[] = [];

				for (const part of parts) {
					if (!part) continue;
					
					const testPath = resolve(current, part);
					if (existsSync(testPath)) {
						current = realpathSync(testPath);
					} else {
						current = testPath;
					}
					resolvedParts.push(current);
				}
				
				resolvedPath = resolvedParts[resolvedParts.length - 1] || normalizedPath;
			}
		} catch (error) {
			throw new PathValidationError(`Failed to resolve path: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}

		if (!resolvedPath.startsWith(this.allowedRoot + sep) && resolvedPath !== this.allowedRoot) {
			throw new PathValidationError('Path is outside allowed root directory');
		}

		if (!allowSymlinks && mustExist) {
			const stats = statSync(normalizedPath, { throwIfNoEntry: false });
			if (stats?.isSymbolicLink()) {
				throw new PathValidationError('Symbolic links are not allowed');
			}
		}

		return resolvedPath;
	}

	isPathSafe(inputPath: string): boolean {
		try {
			this.validatePath(inputPath, { mustExist: false });
			return true;
		} catch {
			return false;
		}
	}

	getAllowedRoot(): string {
		return this.allowedRoot;
	}
}

let mediaPathValidator: PathValidator | null = null;

export function getMediaPathValidator(): PathValidator {
	if (!mediaPathValidator) {
		const mediaPath = getMediaPath();
		
		try {
			mediaPathValidator = new PathValidator(mediaPath);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Media path ${mediaPath} not accessible: ${errorMessage}. Ensure the directory exists and has proper permissions.`);
		}
	}
	
	return mediaPathValidator;
}

export function validateMediaPath(inputPath: string, options?: Partial<PathValidationOptions>): string {
	const validator = getMediaPathValidator();
	return validator.validatePath(inputPath, options);
}

export function isMediaPathSafe(inputPath: string): boolean {
	const validator = getMediaPathValidator();
	return validator.isPathSafe(inputPath);
}
