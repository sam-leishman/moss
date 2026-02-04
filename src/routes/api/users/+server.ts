import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { getDatabase } from '$lib/server/db';
import { hashPassword, validateUsername, validatePassword, normalizeUsername } from '$lib/server/auth/password';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';
import type { User } from '$lib/server/db';

const logger = getLogger('api:users');

export const GET: RequestHandler = async ({ locals }) => {
	try {
		requireAdmin(locals);
		const db = getDatabase();
		
		const users = db.prepare(`
			SELECT id, username, role, is_active, created_at, updated_at
			FROM user
			ORDER BY created_at DESC
		`).all() as User[];
		
		return json({ users });
	} catch (error) {
		logger.error('Failed to list users', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	try {
		const admin = requireAdmin(locals);
		const db = getDatabase();
		
		const body = await request.json();
		const { username, password, role, is_active = 1 } = body;
		
		if (!username || !password) {
			return json({ message: 'Username and password are required' }, { status: 400 });
		}
		
		try {
			validateUsername(username);
		} catch (error) {
			return json({ message: error instanceof Error ? error.message : 'Invalid username' }, { status: 400 });
		}
		
		try {
			validatePassword(password);
		} catch (error) {
			return json({ message: error instanceof Error ? error.message : 'Invalid password' }, { status: 400 });
		}
		
		if (role !== 'admin' && role !== 'user') {
			return json({ message: 'Role must be either "admin" or "user"' }, { status: 400 });
		}
		
		const normalizedUsername = normalizeUsername(username);
		const existingUser = db.prepare('SELECT id FROM user WHERE username = ?').get(normalizedUsername);
		if (existingUser) {
			return json({ message: 'Username already exists' }, { status: 409 });
		}
		
		const passwordHash = await hashPassword(password);
		
		const result = db.prepare(`
			INSERT INTO user (username, password_hash, role, is_active)
			VALUES (?, ?, ?, ?)
		`).run(normalizedUsername, passwordHash, role, is_active ? 1 : 0);
		
		const newUser = db.prepare(`
			SELECT id, username, role, is_active, created_at, updated_at
			FROM user
			WHERE id = ?
		`).get(result.lastInsertRowid) as User;
		
		logger.info(`User created: ${username} (role: ${role})`, { actor: admin.username });
		
		return json({ user: newUser }, { status: 201 });
	} catch (error) {
		logger.error('Failed to create user', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
