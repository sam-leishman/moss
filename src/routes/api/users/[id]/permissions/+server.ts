import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { getDatabase } from '$lib/server/db';
import { getUserLibraries, setUserLibraries } from '$lib/server/auth/permissions';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { User } from '$lib/server/db';

const logger = getLogger('api:users:permissions');

export const GET = async ({ locals, params }: any) => {
	try {
		requireAdmin(locals);
		const db = getDatabase();
		const userId = parseInt(params.id);
		
		if (isNaN(userId)) {
			return json({ message: 'Invalid user ID' }, { status: 400 });
		}
		
		const user = db.prepare('SELECT id, username, role FROM user WHERE id = ?').get(userId) as User | undefined;
		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}
		
		const libraryIds = getUserLibraries(db, user);
		
		return json({ libraryIds });
	} catch (error) {
		logger.error('Failed to get user permissions', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const PUT = async ({ locals, params, request }: any) => {
	try {
		const admin = requireAdmin(locals);
		const db = getDatabase();
		const userId = parseInt(params.id);
		
		if (isNaN(userId)) {
			return json({ message: 'Invalid user ID' }, { status: 400 });
		}
		
		const user = db.prepare('SELECT id, username, role FROM user WHERE id = ?').get(userId) as User | undefined;
		if (!user) {
			return json({ message: 'User not found' }, { status: 404 });
		}
		
		if (user.role === 'admin') {
			return json({ message: 'Cannot set permissions for admin users (they have access to all libraries)' }, { status: 400 });
		}
		
		const body = await request.json();
		const { libraryIds } = body;
		
		if (!Array.isArray(libraryIds)) {
			return json({ message: 'libraryIds must be an array' }, { status: 400 });
		}
		
		if (!libraryIds.every((id: any) => typeof id === 'number' && !isNaN(id))) {
			return json({ message: 'All library IDs must be valid numbers' }, { status: 400 });
		}
		
		const allLibraries = db.prepare('SELECT id FROM library').all() as { id: number }[];
		const validLibraryIds = new Set(allLibraries.map(lib => lib.id));
		
		for (const libId of libraryIds) {
			if (!validLibraryIds.has(libId)) {
				return json({ message: `Library ID ${libId} does not exist` }, { status: 400 });
			}
		}
		
		setUserLibraries(db, userId, libraryIds);
		
		logger.info(`Permissions updated for user: ${user.username}`, { 
			actor: admin.username,
			libraryIds 
		});
		
		return json({ message: 'Permissions updated successfully', libraryIds });
	} catch (error) {
		logger.error('Failed to update user permissions', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
