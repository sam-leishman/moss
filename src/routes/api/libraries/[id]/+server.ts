import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { NotFoundError, ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { getThumbnailGenerator } from '$lib/server/thumbnails';
import { sanitizeLibraryName } from '$lib/server/security/sanitizer';
import { DuplicateEntryError } from '$lib/server/errors';
import type { Library } from '$lib/server/db';

const logger = getLogger('api:libraries');

export const GET = async ({ params }: { params: { id: string } }) => {
	try {
		const db = getDatabase();
		const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;

		if (!library) {
			throw new NotFoundError('Library', params.id);
		}

		return json({ library });
	} catch (error) {
		logger.error(`Failed to fetch library ${params.id}`, error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const DELETE = async ({ params }: { params: { id: string } }) => {
	try {
		const db = getDatabase();
		const thumbnailGen = getThumbnailGenerator();
		
		const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;
		if (!library) {
			throw new NotFoundError('Library', params.id);
		}

		// Get all media paths for this library before deletion
		const mediaFiles = db.prepare('SELECT path FROM media WHERE library_id = ?').all(params.id) as Array<{ path: string }>;
		
		// Delete thumbnails for all media in this library
		let thumbnailsDeleted = 0;
		for (const media of mediaFiles) {
			await thumbnailGen.deleteThumbnail(media.path);
			thumbnailsDeleted++;
		}
		
		logger.info(`Deleted ${thumbnailsDeleted} thumbnails for library ${library.name}`);

		// Delete the library (cascade deletes media entries)
		db.prepare('DELETE FROM library WHERE id = ?').run(params.id);

		logger.info(`Library deleted: ${library.name} (id: ${params.id})`);

		return json({ success: true });
	} catch (error) {
		logger.error(`Failed to delete library ${params.id}`, error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const PATCH = async ({ params, request }: { params: { id: string }, request: Request }) => {
	try {
		const { name } = await request.json();

		if (!name || typeof name !== 'string') {
			throw new ValidationError('Name is required and must be a string');
		}

		const sanitizedName = sanitizeLibraryName(name);

		const db = getDatabase();
		
		// Check if library exists
		const existingLibrary = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;
		if (!existingLibrary) {
			throw new NotFoundError('Library', params.id);
		}

		// Check if name is already taken by another library
		const existingName = db.prepare('SELECT id FROM library WHERE name = ? AND id != ?').get(sanitizedName, params.id);
		if (existingName) {
			throw new DuplicateEntryError('Library', 'name', sanitizedName);
		}

		// Update the library name
		db.prepare('UPDATE library SET name = ? WHERE id = ?').run(sanitizedName, params.id);

		const updatedLibrary = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library;

		logger.info(`Library name updated: ${existingLibrary.name} -> ${sanitizedName} (id: ${params.id})`);

		return json({ library: updatedLibrary });
	} catch (error) {
		logger.error(`Failed to update library name ${params.id}`, error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
