import type { Library } from '$lib/server/db';

/**
 * Fetches all libraries from the API
 * @returns Array of libraries
 */
export async function fetchLibraries(): Promise<Library[]> {
	const response = await fetch('/api/libraries');
	if (!response.ok) {
		throw new Error('Failed to fetch libraries');
	}
	const data = await response.json();
	return data.libraries || [];
}

/**
 * Fetches libraries that contain media for a specific person
 * @param personId - The ID of the person
 * @returns Array of libraries
 */
export async function fetchPersonLibraries(personId: string | number): Promise<Library[]> {
	const response = await fetch(`/api/people/${personId}/libraries`);
	if (!response.ok) {
		throw new Error('Failed to fetch person libraries');
	}
	return await response.json();
}
