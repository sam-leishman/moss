import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { getDatabase } from '$lib/server/db';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('api:users:sessions:delete');

export const DELETE = async ({ locals, params }: any) => {
	try {
		const admin = requireAdmin(locals);
		const db = getDatabase();
		const userId = parseInt(params.id);
		const sessionId = params.sessionId;
		
		if (isNaN(userId)) {
			return json({ message: 'Invalid user ID' }, { status: 400 });
		}
		
		if (!sessionId) {
			return json({ message: 'Session ID is required' }, { status: 400 });
		}
		
		const user = db.prepare('SELECT username FROM user WHERE id = ?').get(userId) as { username: string } | undefined;
		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}
		
		const session = db.prepare('SELECT id FROM session WHERE id = ? AND user_id = ?').get(sessionId, userId);
		if (!session) {
			return json({ message: 'Session not found' }, { status: 404 });
		}
		
		db.prepare('DELETE FROM session WHERE id = ?').run(sessionId);
		
		logger.info(`Session revoked for user: ${user.username}`, { actor: admin.username, sessionId });
		
		return json({ message: 'Session revoked successfully' });
	} catch (error) {
		logger.error('Failed to revoke session', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
