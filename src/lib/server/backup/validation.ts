import { ValidationError } from '$lib/server/errors';
import { existsSync } from 'fs';
import { join } from 'path';

export interface BackupValidationResult {
	backupPath: string;
	backupsDir: string;
}

/**
 * Validates a backup filename for security and format requirements.
 * This validation MUST be performed before any file system operations.
 * 
 * @param backupFilename - The filename to validate
 * @returns Object containing validated paths
 * @throws ValidationError if validation fails
 */
export function validateBackupFilename(backupFilename: string): BackupValidationResult {
	if (!backupFilename) {
		throw new ValidationError('Backup filename is required');
	}

	// CRITICAL: Validate filename BEFORE constructing paths to prevent path traversal
	if (backupFilename.includes('..') || backupFilename.includes('/') || backupFilename.includes('\\')) {
		throw new ValidationError('Invalid backup filename');
	}

	// Validate file format
	if (!backupFilename.endsWith('.db')) {
		throw new ValidationError('Invalid backup file format');
	}

	// Construct paths only after validation
	const configDir = process.env.CONFIG_DIR || (process.env.NODE_ENV === 'development' ? join(process.cwd(), 'test-config') : '/config');
	const backupsDir = join(configDir, 'backups');
	const backupPath = join(backupsDir, backupFilename);

	// Check existence
	if (!existsSync(backupPath)) {
		throw new ValidationError('Backup file not found');
	}

	return { backupPath, backupsDir };
}
