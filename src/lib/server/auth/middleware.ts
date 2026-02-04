import type { User } from '$lib/server/db';
import { getDatabase } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import { isAdmin, canAccessLibrary, getUserLibraries } from './permissions';

interface AuthLocals {
	user?: User;
}

export function requireAuth(locals: AuthLocals): User {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	return locals.user;
}

export function requireAdmin(locals: AuthLocals): User {
	const user = requireAuth(locals);
	if (!isAdmin(user)) {
		throw error(403, 'Admin access required');
	}
	return user;
}

export function requireLibraryAccess(locals: AuthLocals, libraryId: number): User {
	const user = requireAuth(locals);
	const db = getDatabase();
	
	if (!canAccessLibrary(db, user, libraryId)) {
		throw error(403, 'Access to this library is not permitted');
	}
	
	return user;
}

export function filterLibrariesByAccess<T extends { id: number }>(
	locals: AuthLocals,
	libraries: T[]
): T[] {
	if (!locals.user) {
		return [];
	}
	
	if (isAdmin(locals.user)) {
		return libraries;
	}
	
	const db = getDatabase();
	const accessibleLibraryIds = new Set(getUserLibraries(db, locals.user));
	
	return libraries.filter(lib => accessibleLibraryIds.has(lib.id));
}
