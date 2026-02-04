import type Database from 'better-sqlite3';
import type { User } from '$lib/server/db';

export function isAdmin(user: User): boolean {
	return user.role === 'admin';
}

export function canAccessLibrary(db: Database.Database, user: User, libraryId: number): boolean {
	if (isAdmin(user)) {
		return true;
	}
	
	const permission = db.prepare(
		'SELECT 1 FROM library_permission WHERE user_id = ? AND library_id = ?'
	).get(user.id, libraryId);
	
	return permission !== undefined;
}

export function getUserLibraries(db: Database.Database, user: User): number[] {
	if (isAdmin(user)) {
		const libraries = db.prepare('SELECT id FROM library').all() as Array<{ id: number }>;
		return libraries.map(lib => lib.id);
	}
	
	const permissions = db.prepare(
		'SELECT library_id FROM library_permission WHERE user_id = ?'
	).all(user.id) as Array<{ library_id: number }>;
	
	return permissions.map(p => p.library_id);
}

export function grantLibraryAccess(db: Database.Database, userId: number, libraryId: number): void {
	db.prepare(
		'INSERT OR IGNORE INTO library_permission (user_id, library_id) VALUES (?, ?)'
	).run(userId, libraryId);
}

export function revokeLibraryAccess(db: Database.Database, userId: number, libraryId: number): void {
	db.prepare(
		'DELETE FROM library_permission WHERE user_id = ? AND library_id = ?'
	).run(userId, libraryId);
}

export function setUserLibraries(db: Database.Database, userId: number, libraryIds: number[]): void {
	const deleteStmt = db.prepare('DELETE FROM library_permission WHERE user_id = ?');
	const insertStmt = db.prepare('INSERT INTO library_permission (user_id, library_id) VALUES (?, ?)');
	
	const transaction = db.transaction(() => {
		deleteStmt.run(userId);
		for (const libraryId of libraryIds) {
			insertStmt.run(userId, libraryId);
		}
	});
	
	transaction();
}
