import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { getConfigDir, isDevelopment } from '$lib/server/config';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
	if (db) {
		return db;
	}

	const configDir = getConfigDir();
	
	// Ensure directory exists - use try-catch to handle race conditions
	if (!existsSync(configDir)) {
		if (isDevelopment()) {
			try {
				mkdirSync(configDir, { recursive: true });
			} catch (error) {
				// Ignore if directory was created by another process
				if (!existsSync(configDir)) {
					throw error;
				}
			}
		} else {
			throw new Error(`Config directory ${configDir} does not exist. Ensure the directory is mounted and accessible.`);
		}
	}

	const dbPath = join(configDir, 'moss.db');
	
	db = new Database(dbPath, {
		verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
	});

	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('synchronous = NORMAL');
	db.pragma('cache_size = -64000');
	db.pragma('temp_store = MEMORY');

	return db;
}

export function closeDatabase(): void {
	if (db) {
		db.close();
		db = null;
	}
}

export function getDatabasePath(): string {
	return join(getConfigDir(), 'moss.db');
}

process.on('SIGINT', () => {
	closeDatabase();
	process.exit(0);
});

process.on('SIGTERM', () => {
	closeDatabase();
	process.exit(0);
});
