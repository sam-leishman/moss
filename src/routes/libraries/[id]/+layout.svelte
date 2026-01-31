<script lang="ts">
	import LibrarySwitcher from '$lib/components/LibrarySwitcher.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { Menu } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let sidebarOpen = $state(false);

	const toggleSidebar = () => {
		sidebarOpen = !sidebarOpen;
	};

	const closeSidebar = () => {
		sidebarOpen = false;
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

	<Sidebar libraryId={data.library.id} isOpen={sidebarOpen} onClose={closeSidebar} />

	<main class="lg:pl-20 min-h-screen bg-gray-50 dark:bg-gray-950" style="padding-top: var(--header-height);">
		<div class="px-6 py-6">
			{@render children()}
		</div>
	</main>
</div>
