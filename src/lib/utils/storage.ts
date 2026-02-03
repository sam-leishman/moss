/**
 * Browser localStorage utilities for persisting user preferences
 */

const STORAGE_KEYS = {
	LAST_LIBRARY_ID: 'lastLibraryId',
	THEME: 'theme'
} as const;

/**
 * Get the last selected library ID from localStorage
 * @returns The library ID or null if not set
 */
export function getLastLibraryId(): number | null {
	if (typeof window === 'undefined') return null;
	
	const stored = localStorage.getItem(STORAGE_KEYS.LAST_LIBRARY_ID);
	if (!stored) return null;
	
	const parsed = parseInt(stored, 10);
	return isNaN(parsed) ? null : parsed;
}

/**
 * Save the last selected library ID to localStorage
 * @param libraryId - The library ID to save
 */
export function setLastLibraryId(libraryId: number): void {
	if (typeof window === 'undefined') return;
	
	localStorage.setItem(STORAGE_KEYS.LAST_LIBRARY_ID, libraryId.toString());
}

/**
 * Clear the last selected library ID from localStorage
 */
export function clearLastLibraryId(): void {
	if (typeof window === 'undefined') return;
	
	localStorage.removeItem(STORAGE_KEYS.LAST_LIBRARY_ID);
}
