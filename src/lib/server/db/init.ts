import { getDatabase } from './connection';
import { runMigrations } from './migrations';

let initialized = false;

export function initializeDatabase(): void {
	if (initialized) {
		return;
	}

	const db = getDatabase();
	
	try {
		runMigrations(db);
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
