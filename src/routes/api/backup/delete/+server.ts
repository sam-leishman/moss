import { json } from '@sveltejs/kit';
import { handleError, ValidationError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { requireAdmin } from '$lib/server/auth';
import { validateBackupFilename } from '$lib/server/backup';
import { unlinkSync } from 'fs';
import type { RequestHandler } from './$types';

const logger = getLogger('api:backup:delete');

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = requireAdmin(locals);
		const { backupFilename } = await request.json();

		// Prevent deletion of the main database file
		if (backupFilename === 'moss.db') {
			throw new ValidationError('Cannot delete the main database file');
		}

		// CRITICAL: Validate filename BEFORE any file operations to prevent path traversal
		const { backupPath } = validateBackupFilename(backupFilename);

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
