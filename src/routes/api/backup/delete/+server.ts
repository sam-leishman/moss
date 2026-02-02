import { json } from '@sveltejs/kit';
import { handleError, ValidationError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

const logger = getLogger('api:backup:delete');

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { backupFilename } = await request.json();

		if (!backupFilename) {
			throw new ValidationError('Backup filename is required');
		}

		// Validate that the backup filename is safe (no path traversal)
		if (backupFilename.includes('..') || backupFilename.includes('/') || backupFilename.includes('\\')) {
			throw new ValidationError('Invalid backup filename');
		}

		// Validate that the backup file is a database file
		if (!backupFilename.endsWith('.db')) {
			throw new ValidationError('Invalid backup file format');
		}

		// Prevent deletion of the main database file
		if (backupFilename === 'xview.db') {
			throw new ValidationError('Cannot delete the main database file');
		}

		const configDir = process.env.CONFIG_DIR || join(process.cwd(), 'test-config');
		const backupsDir = join(configDir, 'backups');
		const backupPath = join(backupsDir, backupFilename);

		if (!existsSync(backupPath)) {
			throw new ValidationError('Backup file not found');
		}

		// Delete the backup file
		unlinkSync(backupPath);

		logger.info(`Backup deleted: ${backupFilename}`);

		return json({
			success: true,
			message: 'Backup deleted successfully',
			deletedFile: backupFilename
		});
	} catch (error) {
		logger.error('Failed to delete backup', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
