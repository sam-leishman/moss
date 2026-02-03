import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { getCurrentVersion } from '$lib/server/db/migrations';
import { SCHEMA_VERSION } from '$lib/server/db/schema';
import { validateBackupFilename } from '$lib/server/backup';
import type { RequestHandler } from './$types';

const logger = getLogger('api:backup:check');

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { backupFilename } = await request.json();

		// CRITICAL: Validate filename BEFORE any file operations to prevent path traversal
		const { backupPath } = validateBackupFilename(backupFilename);

		// Open the backup database in read-only mode to check its version
		let backupDb: Database.Database | null = null;
		try {
			backupDb = new Database(backupPath, { readonly: true });
			const backupVersion = getCurrentVersion(backupDb);
			const currentVersion = SCHEMA_VERSION;

			logger.info(`Backup version: ${backupVersion}, Current version: ${currentVersion}`);

			return json({
				success: true,
				backupVersion,
				currentVersion,
				requiresMigration: backupVersion < currentVersion,
				isNewer: backupVersion > currentVersion,
				backupFilename
			});
		} finally {
			if (backupDb) {
				backupDb.close();
			}
		}
	} catch (error) {
		logger.error('Failed to check backup', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
