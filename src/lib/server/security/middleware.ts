import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { PathValidationError } from './path-validator';
import { SanitizationError } from './sanitizer';

export interface SecurityContext {
	requestId: string;
	timestamp: Date;
	path: string;
	method: string;
}

export function createSecurityContext(event: RequestEvent): SecurityContext {
	return {
		requestId: crypto.randomUUID(),
		timestamp: new Date(),
		path: event.url.pathname,
		method: event.request.method
	};
}

export function handleSecurityError(error: unknown, context?: SecurityContext) {
	const timestamp = context?.timestamp || new Date();
	const requestId = context?.requestId || 'unknown';

	if (error instanceof PathValidationError) {
		console.warn(`[${timestamp.toISOString()}] [${requestId}] Path validation error:`, error.message);
		return json(
			{
				error: 'Invalid path',
				message: error.message,
				requestId
			},
			{ status: 400 }
		);
	}

	if (error instanceof SanitizationError) {
		console.warn(`[${timestamp.toISOString()}] [${requestId}] Sanitization error:`, error.message);
		return json(
			{
				error: 'Invalid input',
				message: error.message,
				requestId
			},
			{ status: 400 }
		);
	}

	console.error(`[${timestamp.toISOString()}] [${requestId}] Unexpected error:`, error);
	return json(
		{
			error: 'Internal server error',
			message: 'An unexpected error occurred',
			requestId
		},
		{ status: 500 }
	);
}

export function validateContentType(event: RequestEvent, expectedType: string): boolean {
	const contentType = event.request.headers.get('content-type');
	return contentType?.includes(expectedType) ?? false;
}

export function requireJsonBody(event: RequestEvent): void {
	if (!validateContentType(event, 'application/json')) {
		throw new SanitizationError('Content-Type must be application/json');
	}
}

export async function parseJsonBody<T = unknown>(event: RequestEvent): Promise<T> {
	requireJsonBody(event);
	
	try {
		const body = await event.request.json();
		return body as T;
	} catch (error) {
		throw new SanitizationError('Invalid JSON body');
	}
}

export function rateLimitKey(event: RequestEvent): string {
	const forwarded = event.request.headers.get('x-forwarded-for');
	const ip = forwarded ? forwarded.split(',')[0].trim() : event.getClientAddress();
	return `ratelimit:${ip}`;
}

export interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
	const now = Date.now();
	const entry = rateLimitStore.get(key);

	if (!entry || now > entry.resetAt) {
		rateLimitStore.set(key, {
			count: 1,
			resetAt: now + config.windowMs
		});
		return true;
	}

	if (entry.count >= config.maxRequests) {
		return false;
	}

	entry.count++;
	return true;
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function cleanupRateLimits(): void {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now > entry.resetAt) {
			rateLimitStore.delete(key);
		}
	}
}

export function startRateLimitCleanup(): void {
	if (!cleanupInterval) {
		cleanupInterval = setInterval(cleanupRateLimits, 60000);
	}
}

export function stopRateLimitCleanup(): void {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}
}

if (process.env.NODE_ENV === 'production') {
	startRateLimitCleanup();
}
