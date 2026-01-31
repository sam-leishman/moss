export const SCHEMA_VERSION = 4;

export const createTablesSQL = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
	version INTEGER PRIMARY KEY,
	applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Library configuration
CREATE TABLE IF NOT EXISTS library (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	folder_path TEXT NOT NULL UNIQUE,
	path_status TEXT NOT NULL DEFAULT 'ok' CHECK(path_status IN ('ok', 'missing', 'error')),
	path_error TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Media files
CREATE TABLE IF NOT EXISTS media (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	library_id INTEGER NOT NULL,
	path TEXT NOT NULL UNIQUE,
	title TEXT,
	media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video', 'animated')),
	size INTEGER NOT NULL,
	mtime TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE
);

-- Tags
CREATE TABLE IF NOT EXISTS tag (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL CHECK(length(name) <= 50),
	library_id INTEGER,
	is_global INTEGER NOT NULL DEFAULT 0 CHECK(is_global IN (0, 1)),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE,
	UNIQUE(name, library_id),
	CHECK((is_global = 1 AND library_id IS NULL) OR (is_global = 0 AND library_id IS NOT NULL))
);

-- Media to tag relationships
CREATE TABLE IF NOT EXISTS media_tag (
	media_id INTEGER NOT NULL,
	tag_id INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (media_id, tag_id),
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
	FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE
);

-- Person (all credited individuals)
CREATE TABLE IF NOT EXISTS person (
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
);

-- Artist profiles
CREATE TABLE IF NOT EXISTS artist_profile (
	person_id INTEGER PRIMARY KEY,
	style TEXT CHECK(style IN ('2d_animator', '3d_animator', 'illustrator', 'photographer', 'other')),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE
);

-- Performer profiles
CREATE TABLE IF NOT EXISTS performer_profile (
	person_id INTEGER PRIMARY KEY,
	age INTEGER CHECK(age >= 0),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE
);

-- Media credits
CREATE TABLE IF NOT EXISTS media_credit (
	media_id INTEGER NOT NULL,
	person_id INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (media_id, person_id),
	FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
	FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE
);
`;

export const createIndexesSQL = `
-- Library indexes
CREATE INDEX IF NOT EXISTS idx_library_folder_path ON library(folder_path);

-- Media indexes
CREATE INDEX IF NOT EXISTS idx_media_library_id ON media(library_id);
CREATE INDEX IF NOT EXISTS idx_media_path ON media(path);
CREATE INDEX IF NOT EXISTS idx_media_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_library_type ON media(library_id, media_type);

-- Tag indexes
CREATE INDEX IF NOT EXISTS idx_tag_name ON tag(name);
CREATE INDEX IF NOT EXISTS idx_tag_library_id ON tag(library_id);
CREATE INDEX IF NOT EXISTS idx_tag_is_global ON tag(is_global);

-- Media tag indexes
CREATE INDEX IF NOT EXISTS idx_media_tag_media_id ON media_tag(media_id);
CREATE INDEX IF NOT EXISTS idx_media_tag_tag_id ON media_tag(tag_id);

-- Person indexes
CREATE INDEX IF NOT EXISTS idx_person_name ON person(name);
CREATE INDEX IF NOT EXISTS idx_person_role ON person(role);
CREATE INDEX IF NOT EXISTS idx_person_library_id ON person(library_id);
CREATE INDEX IF NOT EXISTS idx_person_is_global ON person(is_global);

-- Media credit indexes
CREATE INDEX IF NOT EXISTS idx_media_credit_media_id ON media_credit(media_id);
CREATE INDEX IF NOT EXISTS idx_media_credit_person_id ON media_credit(person_id);
`;
