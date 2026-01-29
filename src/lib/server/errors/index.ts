export {
	AppError,
	ValidationError,
	DatabaseError,
	NotFoundError,
	DuplicateEntryError,
	FileSystemError,
	PermissionDeniedError,
	LibraryError,
	MediaScanError,
	SecurityError,
	RateLimitError,
	isAppError,
	getErrorCode,
	getStatusCode,
	ErrorCode
} from './app-errors';

export type { ErrorContext } from './app-errors';

export {
	handleError,
	createErrorContext,
	logAndThrow,
	wrapDatabaseError,
	wrapFileSystemError
} from './error-handler';

export type {
	ErrorResponse,
	ErrorHandlerContext
} from './error-handler';
