import { json } from '@sveltejs/kit';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { validateMediaPath, getMediaPathValidator } from '$lib/server/security/path-validator';
import { ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('api:folders');

interface FolderItem {
	name: string;
	path: string;
	isDirectory: boolean;
}

export const GET = async ({ url }: { url: URL }) => {
	try {
		const requestedPath = url.searchParams.get('path');
		const validator = getMediaPathValidator();
		const mediaRoot = validator.getAllowedRoot();

		let targetPath: string;
		if (!requestedPath || requestedPath === '/' || requestedPath === '') {
			targetPath = mediaRoot;
		} else {
			targetPath = validateMediaPath(requestedPath, { mustExist: true });
		}

		const stat = statSync(targetPath);
		if (!stat.isDirectory()) {
			throw new ValidationError('Path is not a directory');
		}

		const entries = readdirSync(targetPath, { withFileTypes: true });
		
		const folders: FolderItem[] = entries
			.filter(entry => entry.isDirectory())
			.map(entry => ({
				name: entry.name,
				path: join(targetPath, entry.name),
				isDirectory: true
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		return json({
			currentPath: targetPath,
			parentPath: targetPath !== mediaRoot ? join(targetPath, '..') : null,
			folders
		});
	} catch (error) {
		logger.error('Failed to list folders', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
