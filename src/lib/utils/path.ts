export function basename(path: string): string {
	const lastSlash = path.lastIndexOf('/');
	const lastBackslash = path.lastIndexOf('\\');
	const lastSeparator = Math.max(lastSlash, lastBackslash);
	
	if (lastSeparator === -1) {
		return path;
	}
	
	return path.substring(lastSeparator + 1);
}

export function dirname(path: string): string {
	const lastSlash = path.lastIndexOf('/');
	const lastBackslash = path.lastIndexOf('\\');
	const lastSeparator = Math.max(lastSlash, lastBackslash);
	
	if (lastSeparator === -1) {
		return '.';
	}
	
	if (lastSeparator === 0) {
		return '/';
	}
	
	return path.substring(0, lastSeparator);
}

export function extname(path: string): string {
	const base = basename(path);
	const lastDot = base.lastIndexOf('.');
	
	if (lastDot === -1 || lastDot === 0) {
		return '';
	}
	
	return base.substring(lastDot);
}
