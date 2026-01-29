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
