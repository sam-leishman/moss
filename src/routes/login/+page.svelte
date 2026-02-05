<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { LogIn, AlertCircle } from 'lucide-svelte';

	let username = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Reactive redirect after auth is initialized
	$effect(() => {
		if (authStore.initialized && authStore.isAuthenticated) {
			goto('/');
		}
	});

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		
		if (!username || !password) {
			error = 'Please enter both username and password';
			return;
		}

		loading = true;
		error = null;

		const result = await authStore.login(username, password, rememberMe);

		if (result.success) {
			goto('/');
		} else {
			error = result.error || 'Login failed';
			loading = false;
		}
	};
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">Moss</h1>
			<p class="text-gray-600 dark:text-gray-400">Sign in to your account</p>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
			<form onsubmit={handleSubmit} class="space-y-6">
				{#if error}
					<div class="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
						<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
						<p class="text-sm">{error}</p>
					</div>
				{/if}

				<div>
					<label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Username
					</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						disabled={loading}
						autocomplete="username"
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
						placeholder="Enter your username"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						disabled={loading}
						autocomplete="current-password"
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
						placeholder="Enter your password"
					/>
				</div>

				<div class="flex items-center">
					<input
						id="remember-me"
						type="checkbox"
						bind:checked={rememberMe}
						disabled={loading}
						class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
					/>
					<label for="remember-me" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
						Remember me for 1 year
					</label>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					<LogIn class="w-4 h-4" />
					{loading ? 'Signing in...' : 'Sign in'}
				</button>
			</form>

			<div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
				<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
					<p class="text-sm text-blue-800 dark:text-blue-200">
						<strong>Default credentials:</strong><br />
						Username: <code class="bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded">admin</code><br />
						Password: <code class="bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded">admin</code>
					</p>
					<p class="text-xs text-blue-700 dark:text-blue-300 mt-2">
						Please change the default password after first login.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
