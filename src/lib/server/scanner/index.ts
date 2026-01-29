export {
	detectMediaType,
	isSupportedMediaFile,
	getSupportedExtensions,
	getExtensionsByType,
	SUPPORTED_FORMATS
} from './media-detector';

export type { SupportedFormats } from './media-detector';

export {
	FileScanner,
	scanDirectory,
	scanDirectoryQuick
} from './file-scanner';

export type {
	ScannedFile,
	ScanOptions,
	ScanResult
} from './file-scanner';
