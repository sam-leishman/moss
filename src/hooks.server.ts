import { initializeDatabase } from '$lib/server/db';

initializeDatabase();

export async function handle({ event, resolve }) {
	return resolve(event);
}
