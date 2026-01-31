import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

// Shared theme detection logic used in both app.html and ThemeStore
// This ensures consistency and prevents FOUC
export function detectTheme(): Theme {
	if (typeof window === 'undefined') return 'light';
	
	const stored = localStorage.getItem('theme');
	const validTheme = (stored === 'light' || stored === 'dark') ? stored : null;
	
	if (validTheme) return validTheme;
	
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	return prefersDark ? 'dark' : 'light';
}

class ThemeStore {
	current = $state<Theme>('light');
	private mediaQuery: MediaQueryList | null = null;

	constructor() {
		if (browser) {
			this.current = detectTheme();
			this.apply();

			// Listen for system theme changes only if user hasn't explicitly set a preference
			const stored = localStorage.getItem('theme');
			if (!stored) {
				this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
				this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
			}
		}
	}

	// Cleanup method to remove event listener
	destroy() {
		this.removeSystemThemeListener();
	}

	private handleSystemThemeChange = (e: MediaQueryListEvent) => {
		// Only update if user hasn't explicitly set a preference
		const stored = localStorage.getItem('theme');
		if (!stored) {
			this.current = e.matches ? 'dark' : 'light';
			this.apply();
		}
	};

	get theme() {
		return this.current;
	}

	toggle() {
		this.current = this.current === 'light' ? 'dark' : 'light';
		this.save();
		this.apply();
		// Remove system theme listener once user explicitly sets a preference
		this.removeSystemThemeListener();
	}

	private removeSystemThemeListener() {
		if (browser && this.mediaQuery) {
			this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
			this.mediaQuery = null;
		}
	}

	set(theme: Theme) {
		this.current = theme;
		this.save();
		this.apply();
		// Remove system theme listener once user explicitly sets a preference
		this.removeSystemThemeListener();
	}

	private save() {
		if (browser) {
			localStorage.setItem('theme', this.current);
		}
	}

	private apply() {
		if (browser && document.documentElement) {
			if (this.current === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
	}
}

export const themeStore = new ThemeStore();
