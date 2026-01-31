import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { NotFoundError, ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { validateMediaPath } from '$lib/server/security/path-validator';
import type { Library } from '$lib/server/db';
import { existsSync } from 'fs';
import { relative, join, normalize } from 'path';

const logger = getLogger('api:relocate');

export const POST = async ({ params, request }: { params: { id: string }; request: Request }) => {
	try {
		const db = getDatabase();
		const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;

		if (!library) {
			throw new NotFoundError('Library', params.id);
		}

		const body = await request.json();
		const { folder_path } = body;

		if (!folder_path || typeof folder_path !== 'string') {
			throw new ValidationError('folder_path is required and must be a string');
		}

		const trimmedPath = folder_path.trim();
		if (!trimmedPath) {
			throw new ValidationError('folder_path cannot be empty');
		}

		logger.info(`Relocating library ${params.id} from ${library.folder_path} to ${trimmedPath}`);

		const validatedPath = validateMediaPath(trimmedPath);

		if (!existsSync(validatedPath)) {
			throw new ValidationError('The specified path does not exist');
		}

		const existingLibrary = db.prepare('SELECT id FROM library WHERE folder_path = ? AND id != ?')
			.get(validatedPath, params.id) as { id: number } | undefined;

		if (existingLibrary) {
			throw new ValidationError('Another library is already using this folder path');
		}

		const oldFolderPath = normalize(library.folder_path);
		const newFolderPath = normalize(validatedPath);

		logger.info(`Relocating library ${params.id}: "${oldFolderPath}" -> "${newFolderPath}"`);

		const mediaItems = db.prepare('SELECT id, path FROM media WHERE library_id = ?')
			.all(params.id) as Array<{ id: number; path: string }>;

		logger.info(`Found ${mediaItems.length} media items to update`);

		// Update library folder_path and all media paths in a single transaction
		const relocateTransaction = db.transaction(() => {
			// Update library folder path
			db.prepare(`
				UPDATE library 
				SET folder_path = ?, 
				    path_status = 'ok',
				    path_error = NULL,
				    updated_at = datetime('now')
				WHERE id = ?
			`).run(validatedPath, params.id);

			// Update all media paths
			const updateMediaPath = db.prepare('UPDATE media SET path = ? WHERE id = ?');
			for (const media of mediaItems) {
				const normalizedMediaPath = normalize(media.path);
				const relativePath = relative(oldFolderPath, normalizedMediaPath);
				
				// Validate that the media path is actually under the old library folder
				// If relative path starts with '..' or is absolute, it's outside the library
				if (relativePath.startsWith('..') || relativePath.startsWith('/')) {
					logger.warn(`Skipping media ${media.id}: path "${media.path}" is not under library folder "${oldFolderPath}"`);
					continue;
				}
				
				const newPath = join(newFolderPath, relativePath);
				
				logger.debug(`Updating media ${media.id}: "${media.path}" -> "${newPath}"`);
				updateMediaPath.run(newPath, media.id);
			}
		});

		relocateTransaction();

		const updatedLibrary = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library;

		logger.info(`Library ${params.id} relocated successfully to ${validatedPath}, updated ${mediaItems.length} media paths`);

		return json({
			success: true,
			library: updatedLibrary,
			updatedMediaCount: mediaItems.length
		});
	} catch (error) {
		logger.error(`Failed to relocate library ${params.id}`, error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
