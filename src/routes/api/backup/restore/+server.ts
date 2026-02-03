import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { closeDatabase, getDatabasePath, getDatabase } from '$lib/server/db';
import { handleError, ValidationError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { getCurrentVersion, runMigrations } from '$lib/server/db/migrations';
import { SCHEMA_VERSION } from '$lib/server/db/schema';
import { validateBackupFilename, restoreLock } from '$lib/server/backup';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

const logger = getLogger('api:backup:restore');

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { backupFilename, confirmMigration } = await request.json();

		// CRITICAL: Validate filename BEFORE any file operations to prevent path traversal
		const { backupPath } = validateBackupFilename(backupFilename);

		// Check the backup version before restoring
		let backupDb: Database.Database | null = null;
		let backupVersion = 0; // Initialize to prevent undefined errors
		try {
			backupDb = new Database(backupPath, { readonly: true });
			backupVersion = getCurrentVersion(backupDb);
		} finally {
			if (backupDb) {
				backupDb.close();
			}
		}

		const currentVersion = SCHEMA_VERSION;

		// If backup is newer than current app version, reject it
		if (backupVersion > currentVersion) {
			throw new ValidationError(
				`Cannot restore backup: backup database version (${backupVersion}) is newer than application version (${currentVersion}). Please update the application first.`
			);
		}

		// If backup is older and requires migration, require confirmation
		if (backupVersion < currentVersion && !confirmMigration) {
			logger.warn(`Restore requires migration from version ${backupVersion} to ${currentVersion}, but confirmMigration not set`);
			return json({
				success: false,
				requiresConfirmation: true,
				backupVersion,
				currentVersion,
				message: `This backup is from an older database version (${backupVersion}). The current application uses version ${currentVersion}. The backup will be automatically migrated after restore. Do you want to proceed?`
			}, { status: 200 });
		}

		// Use lock to prevent concurrent restore operations
		return await restoreLock.withLock('restore', async () => {
			const dbPath = getDatabasePath();
			const configDir = process.env.CONFIG_DIR || join(process.cwd(), 'test-config');
			const backupsDir = join(configDir, 'backups');
			const emergencyBackupPath = join(backupsDir, `emergency-pre-restore-${Date.now()}.db`);

			// Close the current database connection
			closeDatabase();

			try {
				// CRITICAL: Create emergency backup before overwriting
				logger.info(`Creating emergency backup at: ${emergencyBackupPath}`);
				copyFileSync(dbPath, emergencyBackupPath);

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
				
				// Run migrations if the backup is from an older version
				if (backupVersion < currentVersion) {
					logger.info(`Running migrations from version ${backupVersion} to ${currentVersion}`);
					try {
						runMigrations(db);
						logger.info('Migrations completed successfully');
					} catch (migrationError) {
						logger.error('Failed to migrate restored database, rolling back', migrationError instanceof Error ? migrationError : undefined);
						
						// CRITICAL: Rollback to emergency backup on migration failure
						closeDatabase();
						try {
							logger.info('Restoring emergency backup due to migration failure');
							copyFileSync(emergencyBackupPath, dbPath);
							getDatabase(); // Reopen the rolled-back database
							logger.info('Successfully rolled back to pre-restore state');
						} catch (rollbackError) {
							logger.error('CRITICAL: Failed to rollback after migration failure', rollbackError instanceof Error ? rollbackError : undefined);
							throw new ValidationError('Failed to migrate restored database and rollback failed. Emergency backup saved at: ' + emergencyBackupPath);
						}
						
						throw new ValidationError('Failed to migrate restored database. Your original database has been restored.');
					}
				}
		
				// Verify the restored database is valid by running a simple query
				try {
					db.prepare('SELECT COUNT(*) FROM library').get();
				} catch (verifyError) {
					logger.error('Restored database appears to be corrupted, rolling back', verifyError instanceof Error ? verifyError : undefined);
					
					// Rollback to emergency backup
					closeDatabase();
					copyFileSync(emergencyBackupPath, dbPath);
					getDatabase();
					
					throw new ValidationError('Restored database is invalid or corrupted. Your original database has been restored.');
				}

				// Success! Delete emergency backup
				if (existsSync(emergencyBackupPath)) {
					unlinkSync(emergencyBackupPath);
					logger.info('Emergency backup deleted after successful restore');
				}

				const message = backupVersion < currentVersion
					? `Database restored successfully and migrated from version ${backupVersion} to ${currentVersion}. Changes are now in effect.`
					: 'Database restored successfully. Changes are now in effect.';

				logger.info(`Database restored from: ${backupPath}`);

				return json({
					success: true,
					message,
					restoredFrom: backupFilename,
					migrated: backupVersion < currentVersion,
					fromVersion: backupVersion,
					toVersion: currentVersion
				});
			} catch (restoreError) {
				// Ensure database is reopened even on error
				try {
					getDatabase();
				} catch {
					// If we can't reopen, that's a critical error but we've already logged it
				}
				throw restoreError;
			}
		});
	} catch (error) {
		logger.error('Failed to restore database backup', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
