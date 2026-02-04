import { hash, verify } from '@node-rs/argon2';
import { ValidationError } from '$lib/server/errors';

export async function hashPassword(password: string): Promise<string> {
	return await hash(password, {
		memoryCost: 65536,
		timeCost: 3,
		parallelism: 4
	});
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	try {
		return await verify(passwordHash, password);
	} catch {
		return false;
	}
}

export function validatePassword(password: string): void {
	if (!password) {
		throw new ValidationError('Password is required');
	}
}

export function validateUsername(username: string): void {
	if (!username || username.length < 3) {
		throw new ValidationError('Username must be at least 3 characters long');
	}
	
	if (username.length > 50) {
		throw new ValidationError('Username must not exceed 50 characters');
	}
	
	if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
		throw new ValidationError('Username can only contain letters, numbers, underscores, and hyphens');
	}
}

export function normalizeUsername(username: string): string {
	return username.toLowerCase();
}
