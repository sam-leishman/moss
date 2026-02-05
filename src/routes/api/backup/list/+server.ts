import { json } from '@sveltejs/kit';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

const logger = getLogger('api:backup:list');

export const GET: RequestHandler = async () => {
	try {
		const configDir = process.env.CONFIG_DIR || join(process.cwd(), 'test-config');
		const backupsDir = join(configDir, 'backups');
		
		// Return empty list if backups directory doesn't exist
		if (!existsSync(backupsDir)) {
			return json({ backups: [] });
		}
		
		const files = readdirSync(backupsDir);
		const backupFiles = files
			.filter(file => file.startsWith('moss-backup-') && file.endsWith('.db'))
			.map(file => {
				const filePath = join(backupsDir, file);
				const stats = statSync(filePath);
				return {
					filename: file,
					size: stats.size,
					created: stats.birthtime.toISOString(),
					modified: stats.mtime.toISOString()
				};
			})
			.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

		logger.info(`Found ${backupFiles.length} backup files`);

		return json({ backups: backupFiles });
	} catch (error) {
		logger.error('Failed to list backup files', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
