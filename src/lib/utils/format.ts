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

/**
 * Formats a duration in seconds into a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1:23:45" or "3:45")
 */
export function formatDuration(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return 'Unknown';

	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	if (h > 0) {
		return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}
	return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formats a bitrate in bits per second into a human-readable string
 * @param bps - Bitrate in bits per second
 * @returns Formatted string (e.g., "4.5 Mbps")
 */
export function formatBitrate(bps: number): string {
	if (!isFinite(bps) || bps <= 0) return 'Unknown';

	if (bps >= 1_000_000) {
		return `${(bps / 1_000_000).toFixed(1)} Mbps`;
	}
	if (bps >= 1_000) {
		return `${(bps / 1_000).toFixed(0)} Kbps`;
	}
	return `${bps} bps`;
}
