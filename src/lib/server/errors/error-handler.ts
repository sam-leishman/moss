import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getLogger } from '../logging/logger';
import { 
	AppError, 
	isAppError, 
	getErrorCode, 
	getStatusCode,
	ErrorCode 
} from './app-errors';
import { PathValidationError } from '../security/path-validator';
import { SanitizationError } from '../security/sanitizer';

const logger = getLogger('ErrorHandler');

export interface ErrorResponse {
	error: string;
	message: string;
	code: number;
	statusCode: number;
	requestId?: string;
	timestamp: string;
	details?: Record<string, unknown>;
}

export interface ErrorHandlerContext {
	requestId?: string;
	path?: string;
	method?: string;
	userId?: string;
}

export function handleError(
	error: unknown,
	context?: ErrorHandlerContext
): Response {
	const timestamp = new Date().toISOString();
	const requestId = context?.requestId || crypto.randomUUID();

	if (isAppError(error)) {
		logger.error(
			`Application error: ${error.message}`,
			error.cause,
			{
				code: error.code,
				statusCode: error.statusCode,
				requestId,
				path: context?.path,
				method: context?.method,
				details: error.details
			}
		);

		const response: ErrorResponse = {
			error: error.name,
			message: error.message,
			code: error.code,
			statusCode: error.statusCode,
			requestId,
			timestamp,
			details: error.details
		};

		return json(response, { status: error.statusCode });
	}

	if (error instanceof PathValidationError) {
		logger.warn(
			`Path validation error: ${error.message}`,
			{
				requestId,
				path: context?.path
			}
		);

		const response: ErrorResponse = {
			error: 'PathValidationError',
			message: error.message,
			code: ErrorCode.INVALID_PATH,
			statusCode: 400,
			requestId,
			timestamp
		};

		return json(response, { status: 400 });
	}

	if (error instanceof SanitizationError) {
		logger.warn(
			`Sanitization error: ${error.message}`,
			{
				requestId,
				path: context?.path
			}
		);

		const response: ErrorResponse = {
			error: 'SanitizationError',
			message: error.message,
			code: ErrorCode.INVALID_INPUT,
			statusCode: 400,
			requestId,
			timestamp
		};

		return json(response, { status: 400 });
	}

	if (error instanceof Error) {
		logger.error(
			`Unexpected error: ${error.message}`,
			error,
			{
				requestId,
				path: context?.path,
				method: context?.method
			}
		);

		const response: ErrorResponse = {
			error: 'InternalServerError',
			message: 'An unexpected error occurred',
			code: ErrorCode.INTERNAL_ERROR,
			statusCode: 500,
			requestId,
			timestamp
		};

		return json(response, { status: 500 });
	}

	logger.error(
		'Unknown error type',
		undefined,
		{
			error: String(error),
			requestId,
			path: context?.path
		}
	);

	const response: ErrorResponse = {
		error: 'UnknownError',
		message: 'An unknown error occurred',
		code: ErrorCode.UNKNOWN_ERROR,
		statusCode: 500,
		requestId,
		timestamp
	};

	return json(response, { status: 500 });
}

export function createErrorContext(event: RequestEvent): ErrorHandlerContext {
	return {
		requestId: crypto.randomUUID(),
		path: event.url.pathname,
		method: event.request.method
	};
}

export function logAndThrow(
	error: Error,
	context?: string,
	metadata?: Record<string, unknown>
): never {
	const contextLogger = context ? getLogger(context) : logger;
	
	if (isAppError(error)) {
		contextLogger.error(error.message, error.cause, metadata);
	} else {
		contextLogger.error(error.message, error, metadata);
	}
	
	throw error;
}

export function wrapDatabaseError(error: unknown, operation: string): never {
	const message = error instanceof Error ? error.message : String(error);
	logger.error(`Database error during ${operation}: ${message}`, error instanceof Error ? error : undefined);
	
	throw new Error(`Database operation failed: ${operation}`);
}

export function wrapFileSystemError(error: unknown, path: string, operation: string): never {
	const message = error instanceof Error ? error.message : String(error);
	logger.error(
		`File system error during ${operation}: ${message}`,
		error instanceof Error ? error : undefined,
		{ path, operation }
	);
	
	throw new Error(`File system operation failed: ${operation}`);
}
