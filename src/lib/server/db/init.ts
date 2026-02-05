import { getDatabase } from './connection';
import { runMigrations } from './migrations';

let initialized = false;

export async function initializeDatabase(): Promise<void> {
	if (initialized) {
		return;
	}

	const db = getDatabase();
	
	try {
		await runMigrations(db);
		initialized = true;
		console.log('Database initialized successfully');
	} catch (error) {
		console.error('Failed to initialize database:', error);
		throw error;
	}
}

export function resetInitialization(): void {
	initialized = false;
}
