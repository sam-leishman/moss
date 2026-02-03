import { ValidationError } from '$lib/server/errors';

/**
 * Simple in-memory lock for database restore operations.
 * Prevents concurrent restore operations that could corrupt the database.
 */
class RestoreLock {
	private locked = false;
	private lockHolder: string | null = null;

	/**
	 * Attempts to acquire the restore lock.
	 * @param operation - Name of the operation acquiring the lock
	 * @throws ValidationError if lock is already held
	 */
	acquire(operation: string): void {
		if (this.locked) {
			throw new ValidationError(
				`Database restore is already in progress (${this.lockHolder}). Please wait for it to complete.`
			);
		}
		this.locked = true;
		this.lockHolder = operation;
	}

	/**
	 * Releases the restore lock.
	 */
	release(): void {
		this.locked = false;
		this.lockHolder = null;
	}

	/**
	 * Checks if the lock is currently held.
	 */
	isLocked(): boolean {
		return this.locked;
	}

	/**
	 * Executes a function with the lock held, ensuring release even on error.
	 * @param operation - Name of the operation
	 * @param fn - Function to execute with lock held
	 */
	async withLock<T>(operation: string, fn: () => Promise<T>): Promise<T> {
		this.acquire(operation);
		try {
			return await fn();
		} finally {
			this.release();
		}
	}
}

export const restoreLock = new RestoreLock();
