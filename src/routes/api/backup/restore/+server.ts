import { json } from '@sveltejs/kit';
import { closeDatabase, getDatabasePath, getDatabase } from '$lib/server/db';
import { handleError, ValidationError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

const logger = getLogger('api:backup:restore');

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { backupFilename } = await request.json();

		if (!backupFilename) {
			throw new ValidationError('Backup filename is required');
		}

		const configDir = process.env.CONFIG_DIR || join(process.cwd(), 'test-config');
		const backupsDir = join(configDir, 'backups');
		const backupPath = join(backupsDir, backupFilename);

		if (!existsSync(backupPath)) {
			throw new ValidationError('Backup file not found');
		}

		// Validate that the backup filename is safe (no path traversal)
		if (backupFilename.includes('..') || backupFilename.includes('/') || backupFilename.includes('\\')) {
			throw new ValidationError('Invalid backup filename');
		}

		// Validate that the backup file is a database file
		if (!backupFilename.endsWith('.db')) {
			throw new ValidationError('Invalid backup file format');
		}

		const dbPath = getDatabasePath();

		// Close the current database connection
		closeDatabase();

		// Remove existing WAL and SHM files
		const walPath = `${dbPath}-wal`;
		const shmPath = `${dbPath}-shm`;
		
		if (existsSync(walPath)) {
			unlinkSync(walPath);
		}
		
		if (existsSync(shmPath)) {
			unlinkSync(shmPath);
		}

		// Restore the backup (SQLite will create fresh WAL/SHM files when opened)
		copyFileSync(backupPath, dbPath);

		// Reopen the database connection to use the restored database
		const db = getDatabase();
		
		// Verify the restored database is valid by running a simple query
		try {
			db.prepare('SELECT COUNT(*) FROM library').get();
		} catch (error) {
			logger.error('Restored database appears to be corrupted', error instanceof Error ? error : undefined);
			throw new ValidationError('Restored database is invalid or corrupted');
		}

		logger.info(`Database restored from: ${backupPath}`);

		return json({
			success: true,
			message: 'Database restored successfully. Changes are now in effect.',
			restoredFrom: backupFilename
		});
	} catch (error) {
		logger.error('Failed to restore database backup', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
