import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { verifyPassword } from '$lib/server/auth';
import { createSession } from '$lib/server/auth';
import { ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { User } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:auth:login');

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	try {
		
		const { username, password, rememberMe } = await request.json();
		
		if (!username || !password) {
			throw new ValidationError('Username and password are required');
		}
		
		const db = getDatabase();
		// Usernames are stored in lowercase, query directly
		const user = db.prepare('SELECT * FROM user WHERE username = ?').get(username.toLowerCase()) as User | undefined;
		
		if (!user) {
			throw new ValidationError('Invalid username or password');
		}
		
		if (!user.is_active) {
			throw new ValidationError('Account is disabled');
		}
		
		const isValid = await verifyPassword(user.password_hash, password);
		
		if (!isValid) {
			logger.warn(`Failed login attempt for user: ${username}`);
			throw new ValidationError('Invalid username or password');
		}
		
		const userAgent = request.headers.get('user-agent');
		const ipAddress = getClientAddress();
		
		const session = createSession(db, user.id, rememberMe || false, userAgent, ipAddress);
		
		cookies.set('session', session.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: rememberMe ? 365 * 24 * 60 * 60 : 30 * 24 * 60 * 60
		});
		
		logger.info(`User logged in: ${user.username} (id: ${user.id})`);
		
		return json({
			user: {
				id: user.id,
				username: user.username,
				role: user.role,
				created_at: user.created_at
			}
		});
	} catch (error) {
		logger.error('Login failed', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
