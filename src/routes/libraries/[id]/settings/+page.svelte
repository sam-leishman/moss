<script lang="ts">
	import { themeStore } from '$lib/stores/theme.svelte';
	import { Sun, Moon, Check } from 'lucide-svelte';

	const handleThemeChange = (theme: 'light' | 'dark') => {
		themeStore.set(theme);
	};
</script>

<div class="max-w-4xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
		<p class="mt-2 text-gray-600 dark:text-gray-400">Manage your application preferences</p>
	</div>

	<div class="space-y-6">
		<section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
			
			<div class="space-y-4">
				<div>
					<div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
						Theme
					</div>
					<div class="grid grid-cols-2 gap-4">
						<button
							type="button"
							onclick={() => handleThemeChange('light')}
							class="relative flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all {themeStore.theme === 'light' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}"
						>
							{#if themeStore.theme === 'light'}
								<div class="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
									<Check class="w-3 h-3 text-white" />
								</div>
							{/if}
							<Sun class="w-8 h-8 text-gray-700 dark:text-gray-300" />
							<div class="text-center">
								<div class="font-medium text-gray-900 dark:text-white">Light</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Bright and clear</div>
							</div>
						</button>

						<button
							type="button"
							onclick={() => handleThemeChange('dark')}
							class="relative flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all {themeStore.theme === 'dark' ? 'border-blue-600 bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}"
						>
							{#if themeStore.theme === 'dark'}
								<div class="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
									<Check class="w-3 h-3 text-white" />
								</div>
							{/if}
							<Moon class="w-8 h-8 text-gray-700 dark:text-gray-300" />
							<div class="text-center">
								<div class="font-medium text-gray-900 dark:text-white">Dark</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Easy on the eyes</div>
							</div>
						</button>
					</div>
				</div>

				<div class="pt-4 border-t border-gray-200 dark:border-gray-700">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Your theme preference is saved locally and will persist across sessions.
					</p>
				</div>
			</div>
		</section>
	</div>
</div>
