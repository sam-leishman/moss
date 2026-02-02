import { json } from '@sveltejs/kit';
import { getDatabase, getDatabasePath } from '$lib/server/db';
import { handleError, ValidationError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

const logger = getLogger('api:backup');

export const POST: RequestHandler = async () => {
	try {
		const db = getDatabase();
		const dbPath = getDatabasePath();
		
		if (!existsSync(dbPath)) {
			throw new ValidationError('Database file not found');
		}

		const configDir = process.env.CONFIG_DIR || join(process.cwd(), 'test-config');
		const backupsDir = join(configDir, 'backups');
		
		// Create backups directory if it doesn't exist
		if (!existsSync(backupsDir)) {
			mkdirSync(backupsDir, { recursive: true });
		}
		
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupPath = join(backupsDir, `xview-backup-${timestamp}.db`);

		// Perform a checkpoint to ensure all WAL data is flushed to the main database file
		// After this, the .db file contains all data and WAL/SHM files are not needed
		db.pragma('wal_checkpoint(TRUNCATE)');

		// Copy only the main database file (WAL/SHM are transient and will be recreated)
		copyFileSync(dbPath, backupPath);

		logger.info(`Database backup created: ${backupPath}`);

		return json({
			success: true,
			backupPath,
			timestamp
		}, { status: 201 });
	} catch (error) {
		logger.error('Failed to create database backup', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
