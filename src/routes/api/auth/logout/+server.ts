import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { deleteSession } from '$lib/server/auth';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';

const logger = getLogger('api:auth:logout');

export const POST: RequestHandler = async ({ cookies, locals }) => {
	try {
		const sessionId = cookies.get('session');
		
		if (sessionId) {
			const db = getDatabase();
			deleteSession(db, sessionId);
		}
		
		cookies.delete('session', { path: '/' });
		
		if (locals.user) {
			logger.info(`User logged out: ${locals.user.username} (id: ${locals.user.id})`);
		}
		
		return json({ success: true });
	} catch (error) {
		logger.error('Logout failed', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
