import type Database from 'better-sqlite3';
import type { Setting } from '$lib/server/db';

export function getSetting(db: Database.Database, key: string): string | null {
	const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(key) as Pick<Setting, 'value'> | undefined;
	return row?.value ?? null;
}

export function setSetting(db: Database.Database, key: string, value: string): void {
	db.prepare(
		"INSERT INTO setting (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
	).run(key, value);
}

export function hasDefaultCredentials(db: Database.Database): boolean {
	const value = getSetting(db, 'default_credentials_changed');
	return value !== '1';
}

export function markDefaultCredentialsChanged(db: Database.Database): void {
	setSetting(db, 'default_credentials_changed', '1');
}
