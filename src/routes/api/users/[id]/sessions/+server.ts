import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { getDatabase } from '$lib/server/db';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Session } from '$lib/server/db';

const logger = getLogger('api:users:sessions');

export const GET = async ({ locals, params }: any) => {
	try {
		requireAdmin(locals);
		const db = getDatabase();
		const userId = parseInt(params.id);
		
		if (isNaN(userId)) {
			return json({ message: 'Invalid user ID' }, { status: 400 });
		}
		
		const user = db.prepare('SELECT username FROM user WHERE id = ?').get(userId) as { username: string } | undefined;
		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}
		
		const sessions = db.prepare(`
			SELECT id, user_id, expires_at, created_at, last_used_at, user_agent, ip_address
			FROM session
			WHERE user_id = ?
			ORDER BY last_used_at DESC
		`).all(userId) as Session[];
		
		return json({ sessions });
	} catch (error) {
		logger.error('Failed to get user sessions', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
