import type Database from 'better-sqlite3';
import { SCHEMA_VERSION, createTablesSQL, createIndexesSQL } from './schema';

export interface Migration {
	version: number;
	up: (db: Database.Database) => void;
	down?: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
	{
		version: 1,
		up: (db: Database.Database) => {
			db.exec(createTablesSQL);
			db.exec(createIndexesSQL);
			
			const stmt = db.prepare('INSERT INTO schema_version (version) VALUES (?)');
			stmt.run(1);
		},
		down: (db: Database.Database) => {
			const tables = [
				'media_credit',
				'performer_profile',
				'artist_profile',
				'person',
				'media_tag',
				'tag',
				'media',
				'library',
				'schema_version'
			];
			
			for (const table of tables) {
				db.exec(`DROP TABLE IF EXISTS ${table}`);
			}
		}
	},
	{
		version: 2,
		up: (db: Database.Database) => {
			// SQLite ALTER TABLE only supports constant defaults, not function calls
			// Add column with constant default, then update existing rows
			db.exec(`ALTER TABLE media ADD COLUMN birthtime TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'`);
			
			// Update existing rows to use mtime as birthtime (best approximation for existing data)
			db.exec(`UPDATE media SET birthtime = mtime WHERE birthtime = '1970-01-01T00:00:00.000Z'`);
			
			const stmt = db.prepare('INSERT INTO schema_version (version) VALUES (?)');
			stmt.run(2);
		},
		down: (db: Database.Database) => {
			db.exec(`
				CREATE TABLE media_backup AS SELECT 
					id, library_id, path, title, media_type, size, mtime, created_at, updated_at
				FROM media
			`);
			db.exec('DROP TABLE media');
			db.exec('ALTER TABLE media_backup RENAME TO media');
			db.exec('DELETE FROM schema_version WHERE version = 2');
		}
	},
	{
		version: 3,
		up: (db: Database.Database) => {
			db.exec(`ALTER TABLE library ADD COLUMN path_status TEXT NOT NULL DEFAULT 'ok' CHECK(path_status IN ('ok', 'missing', 'error'))`);
			db.exec(`ALTER TABLE library ADD COLUMN path_error TEXT`);
			
			const stmt = db.prepare('INSERT INTO schema_version (version) VALUES (?)');
			stmt.run(3);
		},
		down: (db: Database.Database) => {
			db.exec(`
				CREATE TABLE library_backup AS SELECT 
					id, name, folder_path, created_at, updated_at
				FROM library
			`);
			db.exec('DROP TABLE library');
			db.exec('ALTER TABLE library_backup RENAME TO library');
			db.exec('DELETE FROM schema_version WHERE version = 3');
		}
	},
	{
		version: 4,
		up: (db: Database.Database) => {
			// Disable foreign keys temporarily for safe table recreation
			db.pragma('foreign_keys = OFF');
			
			try {
				// Migrate tag table: add library_id and is_global columns
				// Step 1: Create new tag table with updated schema
				db.exec(`
					CREATE TABLE tag_new (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						name TEXT NOT NULL CHECK(length(name) <= 50),
						library_id INTEGER,
						is_global INTEGER NOT NULL DEFAULT 0 CHECK(is_global IN (0, 1)),
						created_at TEXT NOT NULL DEFAULT (datetime('now')),
						FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE,
						UNIQUE(name, library_id),
						CHECK((is_global = 1 AND library_id IS NULL) OR (is_global = 0 AND library_id IS NOT NULL))
					)
				`);
				
				// Step 2: Migrate existing tags as global (is_global=1, library_id=NULL)
				db.exec(`
					INSERT INTO tag_new (id, name, library_id, is_global, created_at)
					SELECT id, name, NULL, 1, created_at FROM tag
				`);
				
				// Step 3: Drop old table and rename new table
				db.exec('DROP TABLE tag');
				db.exec('ALTER TABLE tag_new RENAME TO tag');
				
				// Step 4: Recreate tag indexes
				db.exec(`
					CREATE INDEX IF NOT EXISTS idx_tag_name ON tag(name);
					CREATE INDEX IF NOT EXISTS idx_tag_library_id ON tag(library_id);
					CREATE INDEX IF NOT EXISTS idx_tag_is_global ON tag(is_global);
				`);
				
				// Migrate person table: add library_id and is_global columns
				// Step 1: Create new person table with updated schema
				db.exec(`
					CREATE TABLE person_new (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						name TEXT NOT NULL,
						role TEXT NOT NULL CHECK(role IN ('artist', 'performer')),
						library_id INTEGER,
						is_global INTEGER NOT NULL DEFAULT 0 CHECK(is_global IN (0, 1)),
						created_at TEXT NOT NULL DEFAULT (datetime('now')),
						updated_at TEXT NOT NULL DEFAULT (datetime('now')),
						FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE,
						UNIQUE(name, library_id),
						CHECK((is_global = 1 AND library_id IS NULL) OR (is_global = 0 AND library_id IS NOT NULL))
					)
				`);
				
				// Step 2: Migrate existing people as global (is_global=1, library_id=NULL)
				db.exec(`
					INSERT INTO person_new (id, name, role, library_id, is_global, created_at, updated_at)
					SELECT id, name, role, NULL, 1, created_at, updated_at FROM person
				`);
				
				// Step 3: Drop old table and rename new table
				db.exec('DROP TABLE person');
				db.exec('ALTER TABLE person_new RENAME TO person');
				
				// Step 4: Recreate person indexes
				db.exec(`
					CREATE INDEX IF NOT EXISTS idx_person_name ON person(name);
					CREATE INDEX IF NOT EXISTS idx_person_role ON person(role);
					CREATE INDEX IF NOT EXISTS idx_person_library_id ON person(library_id);
					CREATE INDEX IF NOT EXISTS idx_person_is_global ON person(is_global);
				`);
				
				const stmt = db.prepare('INSERT INTO schema_version (version) VALUES (?)');
				stmt.run(4);
			} finally {
				// Re-enable foreign keys
				db.pragma('foreign_keys = ON');
			}
		},
		down: (db: Database.Database) => {
			// Rollback: recreate old tag table structure
			db.exec(`
				CREATE TABLE tag_old (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL UNIQUE CHECK(length(name) <= 50),
					created_at TEXT NOT NULL DEFAULT (datetime('now'))
				)
			`);
			
			// Copy only global tags back
			db.exec(`
				INSERT INTO tag_old (id, name, created_at)
				SELECT id, name, created_at FROM tag WHERE is_global = 1
			`);
			
			db.exec('DROP TABLE tag');
			db.exec('ALTER TABLE tag_old RENAME TO tag');
			db.exec('CREATE INDEX IF NOT EXISTS idx_tag_name ON tag(name)');
			
			// Rollback: recreate old person table structure
			db.exec(`
				CREATE TABLE person_old (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL UNIQUE,
					role TEXT NOT NULL CHECK(role IN ('artist', 'performer')),
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					updated_at TEXT NOT NULL DEFAULT (datetime('now'))
				)
			`);
			
			// Copy only global people back
			db.exec(`
				INSERT INTO person_old (id, name, role, created_at, updated_at)
				SELECT id, name, role, created_at, updated_at FROM person WHERE is_global = 1
			`);
			
			db.exec('DROP TABLE person');
			db.exec('ALTER TABLE person_old RENAME TO person');
			db.exec(`
				CREATE INDEX IF NOT EXISTS idx_person_name ON person(name);
				CREATE INDEX IF NOT EXISTS idx_person_role ON person(role);
			`);
			
			db.exec('DELETE FROM schema_version WHERE version = 4');
		}
	},
	{
		version: 5,
		up: async (db: Database.Database) => {
			const { hash } = await import('@node-rs/argon2');
			
			db.exec(`
				CREATE TABLE IF NOT EXISTS user (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL UNIQUE COLLATE NOCASE,
					password_hash TEXT NOT NULL,
					role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
					is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					updated_at TEXT NOT NULL DEFAULT (datetime('now'))
				)
			`);
			
			db.exec(`
				CREATE TABLE IF NOT EXISTS session (
					id TEXT PRIMARY KEY,
					user_id INTEGER NOT NULL,
					expires_at TEXT NOT NULL,
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
					user_agent TEXT,
					ip_address TEXT,
					FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
				)
			`);
			
			db.exec(`
				CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
				CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session(expires_at);
			`);
			
			db.exec(`
				CREATE TABLE IF NOT EXISTS library_permission (
					user_id INTEGER NOT NULL,
					library_id INTEGER NOT NULL,
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					PRIMARY KEY (user_id, library_id),
					FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
					FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE
				)
			`);
			
			const defaultPasswordHash = await hash('admin');
			db.prepare(
				'INSERT INTO user (username, password_hash, role) VALUES (?, ?, ?)'
			).run('admin', defaultPasswordHash, 'admin');
			
			const stmt = db.prepare('INSERT INTO schema_version (version) VALUES (?)');
			stmt.run(5);
		},
		down: (db: Database.Database) => {
			db.exec('DROP TABLE IF EXISTS library_permission');
			db.exec('DROP TABLE IF EXISTS session');
			db.exec('DROP TABLE IF EXISTS user');
			db.exec('DELETE FROM schema_version WHERE version = 5');
		}
	},
	{
		version: 6,
		up: (db: Database.Database) => {
			db.exec(`ALTER TABLE person ADD COLUMN image_path TEXT`);
			
			const stmt = db.prepare('INSERT INTO schema_version (version) VALUES (?)');
			stmt.run(6);
		},
		down: (db: Database.Database) => {
			db.exec(`
				CREATE TABLE person_backup AS SELECT 
					id, name, role, library_id, is_global, created_at, updated_at
				FROM person
			`);
			db.exec('DROP TABLE person');
			db.exec('ALTER TABLE person_backup RENAME TO person');
			db.exec(`
				CREATE INDEX IF NOT EXISTS idx_person_name ON person(name);
				CREATE INDEX IF NOT EXISTS idx_person_role ON person(role);
				CREATE INDEX IF NOT EXISTS idx_person_library_id ON person(library_id);
				CREATE INDEX IF NOT EXISTS idx_person_is_global ON person(is_global);
			`);
			db.exec('DELETE FROM schema_version WHERE version = 6');
		}
	},
	{
		version: 7,
		up: (db: Database.Database) => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS user_media_like (
					user_id INTEGER NOT NULL,
					media_id INTEGER NOT NULL,
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					PRIMARY KEY (user_id, media_id),
					FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
					FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
				)
			`);
			
			db.exec(`
				CREATE INDEX IF NOT EXISTS idx_user_media_like_user_id ON user_media_like(user_id);
				CREATE INDEX IF NOT EXISTS idx_user_media_like_media_id ON user_media_like(media_id);
			`);
			
			const stmt = db.prepare('INSERT INTO schema_version (version) VALUES (?)');
			stmt.run(7);
		},
		down: (db: Database.Database) => {
			db.exec('DROP TABLE IF EXISTS user_media_like');
			db.exec('DELETE FROM schema_version WHERE version = 7');
		}
	}
];

export function getCurrentVersion(db: Database.Database): number {
	try {
		const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number | null };
		return row?.version ?? 0;
	} catch {
		return 0;
	}
}

export function runMigrations(db: Database.Database): void {
	const currentVersion = getCurrentVersion(db);
	
	if (currentVersion === SCHEMA_VERSION) {
		console.log(`Database is up to date (version ${SCHEMA_VERSION})`);
		return;
	}
	
	if (currentVersion > SCHEMA_VERSION) {
		throw new Error(
			`Database version (${currentVersion}) is newer than application version (${SCHEMA_VERSION}). Please update the application.`
		);
	}
	
	const pendingMigrations = migrations.filter(m => m.version > currentVersion);
	
	if (pendingMigrations.length === 0) {
		console.log('No migrations to run');
		return;
	}
	
	console.log(`Running ${pendingMigrations.length} migration(s)...`);
	
	for (const migration of pendingMigrations) {
		console.log(`Applying migration ${migration.version}...`);
		
		const transaction = db.transaction(() => {
			migration.up(db);
		});
		
		try {
			transaction();
			console.log(`Migration ${migration.version} completed successfully`);
		} catch (error) {
			console.error(`Migration ${migration.version} failed:`, error);
			throw error;
		}
	}
	
	console.log('All migrations completed successfully');
}

export function rollbackMigration(db: Database.Database, targetVersion: number): void {
	const currentVersion = getCurrentVersion(db);
	
	if (targetVersion >= currentVersion) {
		throw new Error('Target version must be lower than current version');
	}
	
	const migrationsToRollback = migrations
		.filter(m => m.version > targetVersion && m.version <= currentVersion)
		.sort((a, b) => b.version - a.version);
	
	for (const migration of migrationsToRollback) {
		if (!migration.down) {
			throw new Error(`Migration ${migration.version} does not have a rollback function`);
		}
		
		console.log(`Rolling back migration ${migration.version}...`);
		
		const transaction = db.transaction(() => {
			migration.down!(db);
			db.prepare('DELETE FROM schema_version WHERE version = ?').run(migration.version);
		});
		
		try {
			transaction();
			console.log(`Migration ${migration.version} rolled back successfully`);
		} catch (error) {
			console.error(`Rollback of migration ${migration.version} failed:`, error);
			throw error;
		}
	}
}
