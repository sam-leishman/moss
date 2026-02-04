import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';

const logger = getLogger('api:auth:me');

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const user = requireAuth(locals);
		
		return json({
			user: {
				id: user.id,
				username: user.username,
				role: user.role,
				created_at: user.created_at
			}
		});
	} catch (error) {
		logger.error('Failed to get current user', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
