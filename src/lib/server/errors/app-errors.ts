export enum ErrorCode {
	// General errors (1000-1099)
	UNKNOWN_ERROR = 1000,
	INTERNAL_ERROR = 1001,
	NOT_IMPLEMENTED = 1002,
	
	// Validation errors (1100-1199)
	VALIDATION_ERROR = 1100,
	INVALID_INPUT = 1101,
	INVALID_PATH = 1102,
	INVALID_FILE_TYPE = 1103,
	
	// Database errors (1200-1299)
	DATABASE_ERROR = 1200,
	DATABASE_CONNECTION_ERROR = 1201,
	DATABASE_QUERY_ERROR = 1202,
	DUPLICATE_ENTRY = 1203,
	NOT_FOUND = 1204,
	
	// File system errors (1300-1399)
	FILE_SYSTEM_ERROR = 1300,
	FILE_NOT_FOUND = 1301,
	PERMISSION_DENIED = 1302,
	DIRECTORY_NOT_FOUND = 1303,
	
	// Library errors (1400-1499)
	LIBRARY_ERROR = 1400,
	LIBRARY_NOT_FOUND = 1401,
	LIBRARY_PATH_INVALID = 1402,
	LIBRARY_ALREADY_EXISTS = 1403,
	
	// Media errors (1500-1599)
	MEDIA_ERROR = 1500,
	MEDIA_NOT_FOUND = 1501,
	MEDIA_SCAN_ERROR = 1502,
	UNSUPPORTED_MEDIA_TYPE = 1503,
	
	// Security errors (1600-1699)
	SECURITY_ERROR = 1600,
	UNAUTHORIZED = 1601,
	FORBIDDEN = 1602,
	RATE_LIMIT_EXCEEDED = 1603,
	PATH_TRAVERSAL = 1604
}

export interface ErrorContext {
	code: ErrorCode;
	statusCode?: number;
	details?: Record<string, unknown>;
	cause?: Error;
}

export abstract class AppError extends Error {
	public readonly code: ErrorCode;
	public readonly statusCode: number;
	public readonly details?: Record<string, unknown>;
	public readonly cause?: Error;
	public readonly timestamp: Date;

	constructor(message: string, context: ErrorContext) {
		super(message);
		this.name = this.constructor.name;
		this.code = context.code;
		this.statusCode = context.statusCode ?? 500;
		this.details = context.details;
		this.cause = context.cause;
		this.timestamp = new Date();

		Error.captureStackTrace(this, this.constructor);
	}

	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			statusCode: this.statusCode,
			details: this.details,
			timestamp: this.timestamp.toISOString()
		};
	}
}

export class ValidationError extends AppError {
	constructor(message: string, details?: Record<string, unknown>, cause?: Error) {
		super(message, {
			code: ErrorCode.VALIDATION_ERROR,
			statusCode: 400,
			details,
			cause
		});
	}
}

export class DatabaseError extends AppError {
	constructor(message: string, details?: Record<string, unknown>, cause?: Error) {
		super(message, {
			code: ErrorCode.DATABASE_ERROR,
			statusCode: 500,
			details,
			cause
		});
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string, identifier?: string | number) {
		super(`${resource} not found${identifier ? `: ${identifier}` : ''}`, {
			code: ErrorCode.NOT_FOUND,
			statusCode: 404,
			details: { resource, identifier }
		});
	}
}

export class DuplicateEntryError extends AppError {
	constructor(resource: string, field: string, value: unknown) {
		super(`${resource} with ${field} '${value}' already exists`, {
			code: ErrorCode.DUPLICATE_ENTRY,
			statusCode: 409,
			details: { resource, field, value }
		});
	}
}

export class FileSystemError extends AppError {
	constructor(message: string, path?: string, cause?: Error) {
		super(message, {
			code: ErrorCode.FILE_SYSTEM_ERROR,
			statusCode: 500,
			details: { path },
			cause
		});
	}
}

export class PermissionDeniedError extends AppError {
	constructor(path: string, operation?: string) {
		super(`Permission denied${operation ? ` for ${operation}` : ''}: ${path}`, {
			code: ErrorCode.PERMISSION_DENIED,
			statusCode: 403,
			details: { path, operation }
		});
	}
}

export class LibraryError extends AppError {
	constructor(message: string, libraryId?: number, cause?: Error) {
		super(message, {
			code: ErrorCode.LIBRARY_ERROR,
			statusCode: 500,
			details: { libraryId },
			cause
		});
	}
}

export class MediaScanError extends AppError {
	constructor(message: string, path?: string, cause?: Error) {
		super(message, {
			code: ErrorCode.MEDIA_SCAN_ERROR,
			statusCode: 500,
			details: { path },
			cause
		});
	}
}

export class SecurityError extends AppError {
	constructor(message: string, details?: Record<string, unknown>, cause?: Error) {
		super(message, {
			code: ErrorCode.SECURITY_ERROR,
			statusCode: 403,
			details,
			cause
		});
	}
}

export class RateLimitError extends AppError {
	constructor(retryAfter?: number) {
		super('Rate limit exceeded', {
			code: ErrorCode.RATE_LIMIT_EXCEEDED,
			statusCode: 429,
			details: { retryAfter }
		});
	}
}

export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}

export function getErrorCode(error: unknown): ErrorCode {
	if (isAppError(error)) {
		return error.code;
	}
	return ErrorCode.UNKNOWN_ERROR;
}

export function getStatusCode(error: unknown): number {
	if (isAppError(error)) {
		return error.statusCode;
	}
	return 500;
}
