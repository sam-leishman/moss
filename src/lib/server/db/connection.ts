import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
	if (db) {
		return db;
	}

	const configDir = process.env.CONFIG_DIR || join(process.cwd(), 'test-config');
	
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true });
	}

	const dbPath = join(configDir, 'xview.db');
	
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
	const configDir = process.env.CONFIG_DIR || join(process.cwd(), 'test-config');
	return join(configDir, 'xview.db');
}

process.on('SIGINT', () => {
	closeDatabase();
	process.exit(0);
});

process.on('SIGTERM', () => {
	closeDatabase();
	process.exit(0);
});
