<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { AlertCircle, LogOut } from 'lucide-svelte';

	const handleLogout = async () => {
		await authStore.logout();
	};
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
	<div class="w-full max-w-md">
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
			<div class="flex flex-col items-center text-center">
				<div class="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-4">
					<AlertCircle class="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
				</div>

				<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Library Access</h1>
				<p class="text-gray-600 dark:text-gray-400 mb-6">
					Your account doesn't have access to any libraries yet.
				</p>

				<div class="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-6">
					<p class="text-sm text-blue-800 dark:text-blue-200">
						<strong>What to do next:</strong><br />
						Contact an administrator to grant you access to one or more libraries.
					</p>
				</div>

				{#if authStore.user}
					<div class="w-full space-y-3 text-sm text-gray-600 dark:text-gray-400">
						<div class="flex justify-between">
							<span>Username:</span>
							<span class="font-medium text-gray-900 dark:text-white">{authStore.user.username}</span>
						</div>
						<div class="flex justify-between">
							<span>Role:</span>
							<span class="font-medium text-gray-900 dark:text-white">{authStore.user.role}</span>
						</div>
					</div>
				{/if}

				<button
					type="button"
					onclick={handleLogout}
					class="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
				>
					<LogOut class="w-4 h-4" />
					Logout
				</button>
			</div>
		</div>
	</div>
</div>
