import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeTagName } from '$lib/server/security/sanitizer';
import { DuplicateEntryError, ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Tag } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:tags');

export const GET: RequestHandler = async () => {
	try {
		const db = getDatabase();
		const tags = db.prepare('SELECT * FROM tag ORDER BY name ASC').all() as Tag[];
		
		return json(tags);
	} catch (error) {
		logger.error('Failed to fetch tags', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name } = await request.json();

		if (!name) {
			throw new ValidationError('Tag name is required');
		}

		const sanitizedName = sanitizeTagName(name);

		const db = getDatabase();
		
		const existing = db.prepare('SELECT id FROM tag WHERE name = ?').get(sanitizedName);
		if (existing) {
			throw new DuplicateEntryError('Tag', 'name', sanitizedName);
		}

		const result = db.prepare('INSERT INTO tag (name) VALUES (?)').run(sanitizedName);

		const tag = db.prepare('SELECT * FROM tag WHERE id = ?').get(result.lastInsertRowid) as Tag;

		logger.info(`Tag created: ${sanitizedName}`);
		
		return json({ tag }, { status: 201 });
	} catch (error) {
		logger.error('Failed to create tag', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
