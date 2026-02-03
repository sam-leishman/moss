<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import LibrarySwitcher from '$lib/components/LibrarySwitcher.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { Menu, Settings, ArrowLeft } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { getLastLibraryId } from '$lib/utils/storage';

	let { children } = $props();

	let sidebarOpen = $state(false);

	const toggleSidebar = () => {
		sidebarOpen = !sidebarOpen;
	};

	const closeSidebar = () => {
		sidebarOpen = false;
	};

	// Extract current library from URL if we're in a library context
	const currentLibrary = $derived.by(() => {
		const match = $page.url.pathname.match(/^\/libraries\/(\d+)/);
		return match ? parseInt(match[1]) : null;
	});

	// Check if we're on settings page
	const isSettingsPage = $derived($page.url.pathname.startsWith('/settings'));
	
	// Get last library for back link
	const lastLibraryId = $derived.by(() => {
		if (typeof window === 'undefined') return null;
		return getLastLibraryId();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

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
				{#if isSettingsPage && lastLibraryId}
					<a
						href="/libraries/{lastLibraryId}"
						class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
					>
						<ArrowLeft class="w-4 h-4" />
						<span class="hidden sm:inline">Back to Library</span>
					</a>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				<a
					href="/settings/general"
					class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors {isSettingsPage ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : ''}"
					aria-label="Settings"
				>
					<Settings class="w-5 h-5" />
				</a>
				<LibrarySwitcher libraryId={currentLibrary} />
			</div>
		</div>
	</header>

	<Sidebar libraryId={currentLibrary} isOpen={sidebarOpen} onClose={closeSidebar} />

	<main class="lg:pl-20 min-h-screen bg-gray-50 dark:bg-gray-950" style="padding-top: var(--header-height);">
		{@render children()}
	</main>
</div>
