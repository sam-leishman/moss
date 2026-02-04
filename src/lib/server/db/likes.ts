import type Database from 'better-sqlite3';
import type { UserMediaLike } from './types';

export function toggleMediaLike(
	db: Database.Database,
	userId: number,
	mediaId: number
): boolean {
	const transaction = db.transaction(() => {
		const existing = db
			.prepare('SELECT 1 FROM user_media_like WHERE user_id = ? AND media_id = ?')
			.get(userId, mediaId);

		if (existing) {
			db.prepare('DELETE FROM user_media_like WHERE user_id = ? AND media_id = ?').run(
				userId,
				mediaId
			);
			return false;
		} else {
			db.prepare('INSERT INTO user_media_like (user_id, media_id) VALUES (?, ?)').run(
				userId,
				mediaId
			);
			return true;
		}
	});

	return transaction();
}

export function isMediaLiked(
	db: Database.Database,
	userId: number,
	mediaId: number
): boolean {
	const result = db
		.prepare('SELECT 1 FROM user_media_like WHERE user_id = ? AND media_id = ?')
		.get(userId, mediaId);

	return !!result;
}

export function getUserLikedMediaIds(
	db: Database.Database,
	userId: number,
	libraryIds?: number[]
): number[] {
	let query = `
		SELECT uml.media_id
		FROM user_media_like uml
		INNER JOIN media m ON uml.media_id = m.id
		WHERE uml.user_id = ?
	`;

	const params: (number | number[])[] = [userId];

	if (libraryIds && libraryIds.length > 0) {
		const placeholders = libraryIds.map(() => '?').join(',');
		query += ` AND m.library_id IN (${placeholders})`;
		params.push(...libraryIds);
	}

	const results = db.prepare(query).all(...params) as Array<{ media_id: number }>;

	return results.map((row) => row.media_id);
}

export function deleteLikesForUser(db: Database.Database, userId: number): number {
	const result = db.prepare('DELETE FROM user_media_like WHERE user_id = ?').run(userId);
	return result.changes;
}
