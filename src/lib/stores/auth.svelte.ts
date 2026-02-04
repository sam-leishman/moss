import { browser } from '$app/environment';
import { goto } from '$app/navigation';

export interface AuthUser {
	id: number;
	username: string;
	role: 'admin' | 'user';
	created_at: string;
}

class AuthStore {
	user = $state<AuthUser | null>(null);
	loading = $state(true);
	initialized = $state(false);

	async init() {
		if (!browser) {
			this.loading = false;
			return;
		}

		try {
			const response = await fetch('/api/auth/me');
			
			if (response.ok) {
				const data = await response.json();
				this.user = data.user;
			} else {
				this.user = null;
			}
		} catch (error) {
			console.error('Failed to load user:', error);
			this.user = null;
		} finally {
			this.loading = false;
			this.initialized = true;
		}
	}

	async login(username: string, password: string, rememberMe: boolean = false): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password, rememberMe })
			});

			if (response.ok) {
				const data = await response.json();
				this.user = data.user;
				return { success: true };
			} else {
				const error = await response.json();
				return { success: false, error: error.message || 'Login failed' };
			}
		} catch (error) {
			return { success: false, error: 'Network error. Please try again.' };
		}
	}

	async logout() {
		try {
			const response = await fetch('/api/auth/logout', { method: 'POST' });
			if (!response.ok) {
				throw new Error('Logout failed on server');
			}
			this.user = null;
			if (browser) {
				goto('/login');
			}
		} catch (error) {
			console.error('Logout error:', error);
			// Even if server logout fails, clear local state and redirect
			this.user = null;
			if (browser) {
				goto('/login');
			}
		}
	}

	async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword })
			});

			if (response.ok) {
				return { success: true };
			} else {
				const error = await response.json();
				return { success: false, error: error.message || 'Password change failed' };
			}
		} catch (error) {
			return { success: false, error: 'Network error. Please try again.' };
		}
	}

	get isAuthenticated() {
		return this.user !== null;
	}

	get isAdmin() {
		return this.user?.role === 'admin';
	}
}

export const authStore = new AuthStore();
