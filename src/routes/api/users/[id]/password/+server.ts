import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { getDatabase } from '$lib/server/db';
import { hashPassword, validatePassword } from '$lib/server/auth/password';
import { markDefaultCredentialsChanged, hasDefaultCredentials } from '$lib/server/settings';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('api:users:password');

export const POST = async ({ locals, params, request }: any) => {
	try {
		const admin = requireAdmin(locals);
		const db = getDatabase();
		const userId = parseInt(params.id);
		
		if (isNaN(userId)) {
			return json({ message: 'Invalid user ID' }, { status: 400 });
		}
		
		const user = db.prepare('SELECT username FROM user WHERE id = ?').get(userId) as { username: string } | undefined;
		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}
		
		const body = await request.json();
		const { newPassword } = body;
		
		if (!newPassword) {
			return json({ message: 'New password is required' }, { status: 400 });
		}
		
		// Password validation removed for self-hosted app - only check if provided
		
		const passwordHash = await hashPassword(newPassword);
		
		db.prepare(`
			UPDATE user
			SET password_hash = ?, updated_at = datetime(\'now\')
			WHERE id = ?
		`).run(passwordHash, userId);
		
		db.prepare('DELETE FROM session WHERE user_id = ?').run(userId);
		
		if (hasDefaultCredentials(db)) {
			markDefaultCredentialsChanged(db);
		}
		
		logger.info(`Password changed for user: ${user.username}`, { actor: admin.username });
		
		return json({ message: 'Password updated successfully. All sessions have been invalidated.' });
	} catch (error) {
		logger.error('Failed to change user password', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
