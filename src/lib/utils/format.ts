/**
 * Formats bytes into a human-readable string with appropriate units
 * @param bytes - The number of bytes to format
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
	// Handle edge cases
	if (bytes === 0) return '0 B';
	if (bytes < 0) return '-' + formatBytes(Math.abs(bytes));
	if (!isFinite(bytes)) return 'Invalid size';
	
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats a date string into a localized date string
 * @param dateString - ISO date string or null
 * @returns Formatted date string or 'N/A' if null
 */
export function formatDate(dateString: string | null): string {
	if (!dateString) return 'N/A';
	return new Date(dateString).toLocaleDateString();
}

/**
 * Formats a date string into a localized date and time string
 * @param dateString - ISO date string
 * @returns Formatted date and time string
 */
export function formatDateTime(dateString: string): string {
	return new Date(dateString).toLocaleString();
}
