<script lang="ts">
	import LibrarySwitcher from '$lib/components/LibrarySwitcher.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { Menu, AlertTriangle, FolderOpen, ArrowLeft } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let sidebarOpen = $state(false);

	const toggleSidebar = () => {
		sidebarOpen = !sidebarOpen;
	};

	const closeSidebar = () => {
		sidebarOpen = false;
	};

	const goToLibraries = () => {
		goto('/libraries');
	};
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-950">
	<header class="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-20">
		<div class="flex items-center justify-between px-6 py-4">
			<div class="flex items-center gap-4">
				<button
					type="button"
					onclick={toggleSidebar}
					class="lg:hidden p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
					aria-label="Toggle sidebar"
				>
					<Menu class="w-6 h-6" />
				</button>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">XView</h1>
			</div>
			<LibrarySwitcher currentLibrary={data.library} />
		</div>
	</header>

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
						<button
							type="button"
							onclick={goToLibraries}
							class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-900 dark:text-amber-200 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-md hover:bg-amber-50 dark:hover:bg-gray-700 transition-colors"
						>
							<ArrowLeft class="w-4 h-4" />
							<span>Manage Libraries</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<Sidebar libraryId={data.library.id} isOpen={sidebarOpen} onClose={closeSidebar} />

	<main class="lg:pl-20 min-h-screen bg-gray-50 dark:bg-gray-950" style="padding-top: {data.library.path_status === 'missing' || data.library.path_status === 'error' ? 'calc(var(--header-height) + 60px)' : 'var(--header-height)'};">
		<div class="px-6 py-6">
			{@render children()}
		</div>
	</main>
</div>
