export class SanitizationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SanitizationError';
	}
}

export interface SanitizeStringOptions {
	maxLength?: number;
	minLength?: number;
	allowEmpty?: boolean;
	trim?: boolean;
	pattern?: RegExp;
}

export function sanitizeString(input: unknown, options: SanitizeStringOptions = {}): string {
	const {
		maxLength = 1000,
		minLength = 0,
		allowEmpty = false,
		trim = true,
		pattern
	} = options;

	if (typeof input !== 'string') {
		throw new SanitizationError('Input must be a string');
	}

	let sanitized = trim ? input.trim() : input;

	if (!allowEmpty && sanitized.length === 0) {
		throw new SanitizationError('String cannot be empty');
	}

	if (sanitized.length < minLength) {
		throw new SanitizationError(`String must be at least ${minLength} characters`);
	}

	if (sanitized.length > maxLength) {
		throw new SanitizationError(`String must not exceed ${maxLength} characters`);
	}

	if (sanitized.includes('\0')) {
		throw new SanitizationError('String contains null bytes');
	}

	if (pattern && !pattern.test(sanitized)) {
		throw new SanitizationError('String does not match required pattern');
	}

	return sanitized;
}

export function sanitizeTagName(input: unknown): string {
	return sanitizeString(input, {
		maxLength: 50,
		minLength: 1,
		allowEmpty: false,
		trim: true,
		pattern: /^[a-zA-Z0-9_\-\s]+$/
	});
}

export function sanitizeTitle(input: unknown): string {
	return sanitizeString(input, {
		maxLength: 255,
		minLength: 0,
		allowEmpty: true,
		trim: true
	});
}

export function sanitizePersonName(input: unknown): string {
	return sanitizeString(input, {
		maxLength: 100,
		minLength: 1,
		allowEmpty: false,
		trim: true
	});
}

export function sanitizeLibraryName(input: unknown): string {
	return sanitizeString(input, {
		maxLength: 100,
		minLength: 1,
		allowEmpty: false,
		trim: true,
		pattern: /^[a-zA-Z0-9_\-\s]+$/
	});
}

export function sanitizeInteger(input: unknown, options: { min?: number; max?: number } = {}): number {
	const { min, max } = options;

	if (typeof input === 'string') {
		input = parseInt(input, 10);
	}

	if (typeof input !== 'number' || isNaN(input) || !Number.isInteger(input)) {
		throw new SanitizationError('Input must be an integer');
	}

	if (min !== undefined && input < min) {
		throw new SanitizationError(`Integer must be at least ${min}`);
	}

	if (max !== undefined && input > max) {
		throw new SanitizationError(`Integer must not exceed ${max}`);
	}

	return input;
}

export function sanitizePositiveInteger(input: unknown): number {
	return sanitizeInteger(input, { min: 1 });
}

export function sanitizeEnum<T extends string>(
	input: unknown,
	allowedValues: readonly T[],
	fieldName = 'value'
): T {
	if (typeof input !== 'string') {
		throw new SanitizationError(`${fieldName} must be a string`);
	}

	if (!allowedValues.includes(input as T)) {
		throw new SanitizationError(
			`${fieldName} must be one of: ${allowedValues.join(', ')}`
		);
	}

	return input as T;
}

export const MEDIA_TYPES = ['image', 'video', 'animated'] as const;
export type MediaType = typeof MEDIA_TYPES[number];

export const PERSON_ROLES = ['artist', 'performer'] as const;
export type PersonRole = typeof PERSON_ROLES[number];

export const ARTIST_STYLES = ['2d_animator', '3d_animator', 'illustrator', 'photographer', 'other'] as const;
export type ArtistStyle = typeof ARTIST_STYLES[number];

export const GENDERS = ['male', 'female'] as const;
export type Gender = typeof GENDERS[number];

export function sanitizeMediaType(input: unknown): MediaType {
	return sanitizeEnum(input, MEDIA_TYPES, 'media_type');
}

export function sanitizePersonRole(input: unknown): PersonRole {
	return sanitizeEnum(input, PERSON_ROLES, 'role');
}

export function sanitizeArtistStyle(input: unknown): ArtistStyle {
	return sanitizeEnum(input, ARTIST_STYLES, 'style');
}

export function sanitizeGender(input: unknown): Gender {
	return sanitizeEnum(input, GENDERS, 'gender');
}

export function sanitizeBirthday(input: unknown): string {
	if (typeof input !== 'string') {
		throw new SanitizationError('Birthday must be a string');
	}

	const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
	if (!isoDatePattern.test(input)) {
		throw new SanitizationError('Birthday must be in ISO format (YYYY-MM-DD)');
	}

	const date = new Date(input);
	if (isNaN(date.getTime())) {
		throw new SanitizationError('Birthday must be a valid date');
	}

	const now = new Date();
	if (date > now) {
		throw new SanitizationError('Birthday cannot be in the future');
	}

	return input;
}
