export { getDatabase, closeDatabase, getDatabasePath } from './connection';
export { initializeDatabase, resetInitialization } from './init';
export { runMigrations, rollbackMigration, getCurrentVersion } from './migrations';
export { SCHEMA_VERSION } from './schema';
export type {
	Library,
	Media,
	Tag,
	MediaTag,
	Person,
	ArtistProfile,
	PerformerProfile,
	MediaCredit,
	SchemaVersion,
	User,
	Session,
	LibraryPermission,
	UserMediaLike,
	Setting
} from './types';
