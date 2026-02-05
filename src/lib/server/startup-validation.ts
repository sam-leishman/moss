import { existsSync, accessSync, constants, mkdirSync } from 'fs';
import { getLogger } from './logging';
import { getConfigDir, getMetadataDir, getMediaPath, isDevelopment } from './config';

const logger = getLogger('startup-validation');

interface DirectoryConfig {
	path: string;
	name: string;
	required: boolean;
	writable: boolean;
}

export function validateStartupEnvironment(): void {
	const isDevMode = isDevelopment();
	
	const directories: DirectoryConfig[] = [
		{
			path: getConfigDir(),
			name: 'CONFIG_DIR',
			required: true,
			writable: true
		},
		{
			path: getMetadataDir(),
			name: 'METADATA_DIR',
			required: true,
			writable: true
		},
		{
			path: getMediaPath(),
			name: 'MEDIA_PATH',
			required: false,
			writable: false
		}
	];

	const errors: string[] = [];
	const warnings: string[] = [];

	for (const dir of directories) {
		// In development, create directories if they don't exist
		if (isDevMode && !existsSync(dir.path)) {
			try {
				mkdirSync(dir.path, { recursive: true });
				logger.info(`Created development directory: ${dir.path}`);
			} catch (error) {
				errors.push(`Failed to create ${dir.name} directory at ${dir.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				continue;
			}
		}

		// Check if directory exists
		if (!existsSync(dir.path)) {
			if (dir.required) {
				errors.push(`${dir.name} directory does not exist: ${dir.path}`);
			} else {
				warnings.push(`${dir.name} directory does not exist: ${dir.path}`);
			}
			continue;
		}

		// Check if directory is accessible
		try {
			accessSync(dir.path, constants.R_OK);
		} catch {
			const msg = `${dir.name} directory is not readable: ${dir.path}`;
			if (dir.required) {
				errors.push(msg);
			} else {
				warnings.push(msg);
			}
			continue;
		}

		// Check if directory is writable (if required)
		if (dir.writable) {
			try {
				accessSync(dir.path, constants.W_OK);
			} catch {
				const msg = `${dir.name} directory is not writable: ${dir.path}`;
				if (dir.required) {
					errors.push(msg);
				} else {
					warnings.push(msg);
				}
				continue;
			}
		}

		logger.info(`✓ ${dir.name}: ${dir.path}`);
	}

	// Log warnings
	for (const warning of warnings) {
		logger.warn(warning);
	}

	// If there are errors, fail fast
	if (errors.length > 0) {
		logger.error('Startup validation failed:');
		for (const error of errors) {
			logger.error(`  - ${error}`);
		}
		
		if (!isDevMode) {
			logger.error('');
			logger.error('In production, ensure all required directories are:');
			logger.error('  1. Created before starting the container');
			logger.error('  2. Mounted as volumes in docker-compose.yml');
			logger.error('  3. Have proper permissions for the application user');
		}
		
		throw new Error('Startup validation failed. See logs above for details.');
	}

	logger.info('Startup validation completed successfully');
}
