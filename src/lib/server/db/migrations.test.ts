import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

describe('migration version 8', () => {
	let db: Database.Database;

	beforeEach(() => {
		db = new Database(':memory:');
		db.pragma('journal_mode = WAL');

		// Set up the base schema (simplified media table pre-migration)
		db.exec(`
			CREATE TABLE schema_version (
				version INTEGER PRIMARY KEY,
				applied_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);
		db.exec(`INSERT INTO schema_version (version) VALUES (7)`);

		db.exec(`
			CREATE TABLE library (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				folder_path TEXT NOT NULL UNIQUE,
				path_status TEXT NOT NULL DEFAULT 'ok',
				path_error TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);

		db.exec(`
			CREATE TABLE media (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				library_id INTEGER NOT NULL,
				path TEXT NOT NULL UNIQUE,
				title TEXT,
				media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video', 'animated')),
				size INTEGER NOT NULL,
				mtime TEXT NOT NULL,
				birthtime TEXT NOT NULL DEFAULT (datetime('now')),
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE
			)
		`);

		// Insert test data
		db.exec(`INSERT INTO library (name, folder_path) VALUES ('Test', '/test')`);
		db.exec(`
			INSERT INTO media (library_id, path, media_type, size, mtime)
			VALUES (1, '/test/video.mp4', 'video', 1000, '2024-01-01')
		`);
		db.exec(`
			INSERT INTO media (library_id, path, media_type, size, mtime)
			VALUES (1, '/test/image.jpg', 'image', 500, '2024-01-01')
		`);
	});

	afterEach(() => {
		db.close();
	});

	function applyMigration8() {
		db.exec(`ALTER TABLE media ADD COLUMN duration REAL`);
		db.exec(`ALTER TABLE media ADD COLUMN width INTEGER`);
		db.exec(`ALTER TABLE media ADD COLUMN height INTEGER`);
		db.exec(`ALTER TABLE media ADD COLUMN video_codec TEXT`);
		db.exec(`ALTER TABLE media ADD COLUMN audio_codec TEXT`);
		db.exec(`ALTER TABLE media ADD COLUMN container_format TEXT`);
		db.exec(`ALTER TABLE media ADD COLUMN bitrate INTEGER`);
		db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(8);
	}

	it('adds all new columns to the media table', () => {
		applyMigration8();

		const columns = db.pragma('table_info(media)') as Array<{ name: string; type: string }>;
		const columnNames = columns.map((c) => c.name);

		expect(columnNames).toContain('duration');
		expect(columnNames).toContain('width');
		expect(columnNames).toContain('height');
		expect(columnNames).toContain('video_codec');
		expect(columnNames).toContain('audio_codec');
		expect(columnNames).toContain('container_format');
		expect(columnNames).toContain('bitrate');
	});

	it('new columns have correct types', () => {
		applyMigration8();

		const columns = db.pragma('table_info(media)') as Array<{ name: string; type: string }>;
		const colMap = Object.fromEntries(columns.map((c) => [c.name, c.type]));

		expect(colMap['duration']).toBe('REAL');
		expect(colMap['width']).toBe('INTEGER');
		expect(colMap['height']).toBe('INTEGER');
		expect(colMap['video_codec']).toBe('TEXT');
		expect(colMap['audio_codec']).toBe('TEXT');
		expect(colMap['container_format']).toBe('TEXT');
		expect(colMap['bitrate']).toBe('INTEGER');
	});

	it('preserves existing data after migration', () => {
		applyMigration8();

		const rows = db.prepare('SELECT * FROM media ORDER BY id').all() as Array<Record<string, unknown>>;
		expect(rows).toHaveLength(2);

		expect(rows[0].path).toBe('/test/video.mp4');
		expect(rows[0].media_type).toBe('video');
		expect(rows[0].size).toBe(1000);

		expect(rows[1].path).toBe('/test/image.jpg');
		expect(rows[1].media_type).toBe('image');
		expect(rows[1].size).toBe(500);
	});

	it('new columns default to NULL for existing rows', () => {
		applyMigration8();

		const row = db.prepare('SELECT * FROM media WHERE id = 1').get() as Record<string, unknown>;

		expect(row.duration).toBeNull();
		expect(row.width).toBeNull();
		expect(row.height).toBeNull();
		expect(row.video_codec).toBeNull();
		expect(row.audio_codec).toBeNull();
		expect(row.container_format).toBeNull();
		expect(row.bitrate).toBeNull();
	});

	it('allows writing video metadata to new columns', () => {
		applyMigration8();

		db.prepare(`
			UPDATE media 
			SET duration = ?, width = ?, height = ?,
			    video_codec = ?, audio_codec = ?,
			    container_format = ?, bitrate = ?
			WHERE id = 1
		`).run(120.5, 1920, 1080, 'h264', 'aac', 'mov', 4500000);

		const row = db.prepare('SELECT * FROM media WHERE id = 1').get() as Record<string, unknown>;

		expect(row.duration).toBe(120.5);
		expect(row.width).toBe(1920);
		expect(row.height).toBe(1080);
		expect(row.video_codec).toBe('h264');
		expect(row.audio_codec).toBe('aac');
		expect(row.container_format).toBe('mov');
		expect(row.bitrate).toBe(4500000);
	});

	it('allows inserting new media with video metadata', () => {
		applyMigration8();

		db.prepare(`
			INSERT INTO media (library_id, path, media_type, size, mtime,
			    duration, width, height, video_codec, audio_codec, container_format, bitrate)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(1, '/test/new.mkv', 'video', 2000, '2024-06-01',
			90.0, 3840, 2160, 'hevc', 'flac', 'matroska', 25000000);

		const row = db.prepare('SELECT * FROM media WHERE path = ?').get('/test/new.mkv') as Record<string, unknown>;

		expect(row.duration).toBe(90.0);
		expect(row.width).toBe(3840);
		expect(row.height).toBe(2160);
		expect(row.video_codec).toBe('hevc');
		expect(row.audio_codec).toBe('flac');
		expect(row.container_format).toBe('matroska');
		expect(row.bitrate).toBe(25000000);
	});

	it('updates schema_version to 8', () => {
		applyMigration8();

		const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number };
		expect(row.version).toBe(8);
	});

	it('rollback removes new columns and restores data', () => {
		applyMigration8();

		// Write some metadata
		db.prepare(`
			UPDATE media SET duration = 120.5, width = 1920, height = 1080,
			    video_codec = 'h264', audio_codec = 'aac',
			    container_format = 'mov', bitrate = 4500000
			WHERE id = 1
		`).run();

		// Rollback
		db.pragma('foreign_keys = OFF');
		db.exec(`
			CREATE TABLE media_backup AS SELECT 
				id, library_id, path, title, media_type, size, mtime, birthtime, created_at, updated_at
			FROM media
		`);
		db.exec('DROP TABLE media');
		db.exec(`
			CREATE TABLE media (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				library_id INTEGER NOT NULL,
				path TEXT NOT NULL UNIQUE,
				title TEXT,
				media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video', 'animated')),
				size INTEGER NOT NULL,
				mtime TEXT NOT NULL,
				birthtime TEXT NOT NULL DEFAULT (datetime('now')),
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE
			)
		`);
		db.exec(`
			INSERT INTO media (id, library_id, path, title, media_type, size, mtime, birthtime, created_at, updated_at)
			SELECT id, library_id, path, title, media_type, size, mtime, birthtime, created_at, updated_at
			FROM media_backup
		`);
		db.exec('DROP TABLE media_backup');
		db.pragma('foreign_keys = ON');
		db.exec('DELETE FROM schema_version WHERE version = 8');

		// Verify columns are gone
		const columns = db.pragma('table_info(media)') as Array<{ name: string }>;
		const columnNames = columns.map((c) => c.name);
		expect(columnNames).not.toContain('duration');
		expect(columnNames).not.toContain('video_codec');

		// Verify data preserved
		const rows = db.prepare('SELECT * FROM media ORDER BY id').all() as Array<Record<string, unknown>>;
		expect(rows).toHaveLength(2);
		expect(rows[0].path).toBe('/test/video.mp4');
		expect(rows[0].size).toBe(1000);

		// Verify schema version
		const version = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number };
		expect(version.version).toBe(7);
	});
});
