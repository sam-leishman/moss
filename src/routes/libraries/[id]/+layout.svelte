<script lang="ts">
	import { AlertTriangle, Wrench } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

{#if data.library.path_status === 'missing' || data.library.path_status === 'error'}
		<div class="fixed left-0 right-0 lg:left-20 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 z-10" style="top: var(--header-height);">
			<div class="px-6 py-3">
				<div class="flex items-center justify-between gap-4">
					<div class="flex items-center gap-3">
						<AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0" />
						<div>
							<p class="text-sm font-medium text-amber-900 dark:text-amber-200">
								Library path not accessible
							</p>
							<p class="text-xs text-amber-700 dark:text-amber-300">
								{data.library.path_error || 'The folder for this library cannot be found'}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<a
							href="/libraries/{data.library.id}/manage"
							class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-900 dark:text-amber-200 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-md hover:bg-amber-50 dark:hover:bg-gray-700 transition-colors"
						>
							<Wrench class="w-4 h-4" />
							<span>Manage Library</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	{/if}

<div style="padding-top: {data.library.path_status === 'missing' || data.library.path_status === 'error' ? '60px' : '0'};">
	<div class="px-6 py-6">
		{@render children()}
	</div>
</div>
