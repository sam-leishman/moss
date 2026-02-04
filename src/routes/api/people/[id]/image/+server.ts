import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security/sanitizer';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { getPersonImageManager } from '$lib/server/images';
import type { Person } from '$lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';

const logger = getLogger('api:person-image');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const POST = async ({ params, request }: RequestEvent) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person | undefined;
		if (!person) {
			error(404, 'Person not found');
		}

		const formData = await request.formData();
		const imageFile = formData.get('image') as File | null;

		if (!imageFile) {
			error(400, 'No image file provided');
		}

		if (!ALLOWED_TYPES.includes(imageFile.type)) {
			error(400, `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
		}

		if (imageFile.size > MAX_FILE_SIZE) {
			error(400, `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
		}

		const arrayBuffer = await imageFile.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const imageManager = getPersonImageManager();
		const { imagePath } = await imageManager.savePersonImage(personId, buffer);

		db.prepare('UPDATE person SET image_path = ?, updated_at = datetime(\'now\') WHERE id = ?')
			.run(imagePath, personId);

		logger.info(`Image uploaded for person ${personId}: ${person.name}`);

		return json({ 
			success: true, 
			imagePath,
			message: 'Image uploaded successfully'
		});
	} catch (err) {
		logger.error('Failed to upload person image', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const DELETE = async ({ params }: RequestEvent) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person | undefined;
		if (!person) {
			error(404, 'Person not found');
		}

		if (!person.image_path) {
			error(404, 'Person has no image');
		}

		const imageManager = getPersonImageManager();
		await imageManager.deletePersonImage(personId);

		db.prepare('UPDATE person SET image_path = NULL, updated_at = datetime(\'now\') WHERE id = ?')
			.run(personId);

		logger.info(`Image deleted for person ${personId}: ${person.name}`);

		return json({ success: true, message: 'Image deleted successfully' });
	} catch (err) {
		logger.error('Failed to delete person image', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
