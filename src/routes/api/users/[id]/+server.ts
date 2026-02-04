import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { getDatabase } from '$lib/server/db';
import { validateUsername, normalizeUsername } from '$lib/server/auth/password';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { User } from '$lib/server/db';

const logger = getLogger('api:users:id');

export const GET = async ({ locals, params }: any) => {
	try {
		requireAdmin(locals);
		const db = getDatabase();
		const userId = parseInt(params.id);
		
		if (isNaN(userId)) {
			return json({ message: 'Invalid user ID' }, { status: 400 });
		}
		
		const user = db.prepare(`
			SELECT id, username, role, is_active, created_at, updated_at
			FROM user
			WHERE id = ?
		`).get(userId) as User | undefined;
		
		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}
		
		return json({ user });
	} catch (error) {
		logger.error('Failed to get user', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const PATCH = async ({ locals, params, request }: any) => {
	try {
		const admin = requireAdmin(locals);
		const db = getDatabase();
		const userId = parseInt(params.id);
		
		if (isNaN(userId)) {
			return json({ message: 'Invalid user ID' }, { status: 400 });
		}
		
		const existingUser = db.prepare('SELECT id, username FROM user WHERE id = ?').get(userId) as User | undefined;
		if (!existingUser) {
			return json({ message: 'User not found' }, { status: 404 });
		}
		
		const body = await request.json();
		const { username, role, is_active } = body;
		
		const updates: string[] = [];
		const values: any[] = [];
		
		if (username !== undefined) {
			try {
				validateUsername(username);
			} catch (error) {
				return json({ message: error instanceof Error ? error.message : 'Invalid username' }, { status: 400 });
			}
			
			const normalizedUsername = normalizeUsername(username);
			const usernameConflict = db.prepare('SELECT id FROM user WHERE username = ? AND id != ?').get(normalizedUsername, userId);
			if (usernameConflict) {
				return json({ message: 'Username already exists' }, { status: 409 });
			}
			
			updates.push('username = ?');
			values.push(normalizedUsername);
		}
		
		if (role !== undefined) {
			if (role !== 'admin' && role !== 'user') {
				return json({ message: 'Role must be either "admin" or "user"' }, { status: 400 });
			}
			updates.push('role = ?');
			values.push(role);
		}
		
		if (is_active !== undefined) {
			updates.push('is_active = ?');
			values.push(is_active ? 1 : 0);
		}
		
		if (updates.length === 0) {
			return json({ message: 'No fields to update' }, { status: 400 });
		}
		
		updates.push('updated_at = datetime(\'now\')');
		values.push(userId);
		
		db.prepare(`
			UPDATE user
			SET ${updates.join(', ')}
			WHERE id = ?
		`).run(...values);
		
		const updatedUser = db.prepare(`
			SELECT id, username, role, is_active, created_at, updated_at
			FROM user
			WHERE id = ?
		`).get(userId) as User;
		
		logger.info(`User updated: ${existingUser.username} -> ${updatedUser.username}`, { actor: admin.username });
		
		return json({ user: updatedUser });
	} catch (error) {
		logger.error('Failed to update user', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const DELETE = async ({ locals, params }: any) => {
	try {
		const admin = requireAdmin(locals);
		const db = getDatabase();
		const userId = parseInt(params.id);
		
		if (isNaN(userId)) {
			return json({ message: 'Invalid user ID' }, { status: 400 });
		}
		
		if (userId === admin.id) {
			return json({ message: 'Cannot delete your own account' }, { status: 400 });
		}
		
		const user = db.prepare('SELECT username FROM user WHERE id = ?').get(userId) as { username: string } | undefined;
		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}
		
		db.prepare('DELETE FROM user WHERE id = ?').run(userId);
		
		logger.info(`User deleted: ${user.username}`, { actor: admin.username });
		
		return json({ message: 'User deleted successfully' });
	} catch (error) {
		logger.error('Failed to delete user', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
