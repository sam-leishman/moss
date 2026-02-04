import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { requireAuth, verifyPassword, hashPassword, validatePassword, deleteAllUserSessions } from '$lib/server/auth';
import { ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { rateLimitKey, checkRateLimit } from '$lib/server/security';
import type { RequestHandler } from './$types';

const logger = getLogger('api:auth:change-password');

export const POST: RequestHandler = async ({ request, locals, cookies, getClientAddress }) => {
	try {
		const user = requireAuth(locals);
		
		const key = `${rateLimitKey({ request, getClientAddress } as any)}:${user.id}`;
		if (!checkRateLimit(key, { maxRequests: 3, windowMs: 15 * 60 * 1000 })) {
			logger.warn(`Rate limit exceeded for password change attempt by user ${user.username}`);
			throw error(429, 'Too many password change attempts. Please try again later.');
		}
		const { currentPassword, newPassword } = await request.json();
		
		if (!currentPassword || !newPassword) {
			throw new ValidationError('Current password and new password are required');
		}
		
		const db = getDatabase();
		const isValid = await verifyPassword(user.password_hash, currentPassword);
		
		if (!isValid) {
			throw new ValidationError('Current password is incorrect');
		}
		
		validatePassword(newPassword);
		
		const newPasswordHash = await hashPassword(newPassword);
		
		db.prepare('UPDATE user SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
			.run(newPasswordHash, user.id);
		
		const currentSessionId = cookies.get('session');
		deleteAllUserSessions(db, user.id);
		
		if (currentSessionId) {
			cookies.delete('session', { path: '/' });
		}
		
		logger.info(`Password changed for user: ${user.username} (id: ${user.id})`);
		
		return json({ success: true, message: 'Password changed successfully. Please log in again.' });
	} catch (error) {
		logger.error('Password change failed', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
