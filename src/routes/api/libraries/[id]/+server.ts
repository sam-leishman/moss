import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { NotFoundError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
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
		
		const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;
		if (!library) {
			throw new NotFoundError('Library', params.id);
		}

		db.prepare('DELETE FROM library WHERE id = ?').run(params.id);

		logger.info(`Library deleted: ${library.name} (id: ${params.id})`);

		return json({ success: true });
	} catch (error) {
		logger.error(`Failed to delete library ${params.id}`, error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
