import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { hasDefaultCredentials } from '$lib/server/settings';
import { handleError } from '$lib/server/errors';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const db = getDatabase();
		const showDefaultCredentials = hasDefaultCredentials(db);
		
		return json({ showDefaultCredentials });
	} catch (error) {
		return handleError(error);
	}
};
