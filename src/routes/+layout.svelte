<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import LibrarySwitcher from '$lib/components/LibrarySwitcher.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { Menu, Settings, ArrowLeft, LogOut, User } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getLastLibraryId } from '$lib/utils/storage';
	import { authStore } from '$lib/stores/auth.svelte';
	import { likesStore } from '$lib/stores/likes.svelte';
	import { onMount } from 'svelte';

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
	
	// Check if we're on login page
	const isLoginPage = $derived($page.url.pathname === '/login');
	
	// Get last library for back link
	const lastLibraryId = $derived.by(() => {
		if (typeof window === 'undefined') return null;
		return getLastLibraryId();
	});

	// Initialize auth and handle redirects
	onMount(async () => {
		await authStore.init();
		if (authStore.isAuthenticated) {
			await likesStore.init();
		}
	});

	// Reactive redirect after auth is initialized
	$effect(() => {
		if (authStore.initialized && !authStore.isAuthenticated && !isLoginPage) {
			goto('/login');
		}
	});

	const handleLogout = async () => {
		likesStore.clear();
		await authStore.logout();
	};
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if authStore.loading}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
		<div class="text-center">
			<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
		</div>
	</div>
{:else if !authStore.isAuthenticated && isLoginPage}
	{@render children()}
{:else if authStore.isAuthenticated}
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
					<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Moss</h1>
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
					<div class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg">
						<User class="w-4 h-4" />
						<span class="hidden sm:inline">{authStore.user?.username}</span>
						{#if authStore.isAdmin}
							<span class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded">Admin</span>
						{/if}
					</div>
					<a
						href="/settings/general"
						class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors {isSettingsPage ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : ''}"
						aria-label="Settings"
					>
						<Settings class="w-5 h-5" />
					</a>
					<LibrarySwitcher libraryId={currentLibrary} />
					<button
						type="button"
						onclick={handleLogout}
						class="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
						aria-label="Logout"
						title="Logout"
					>
						<LogOut class="w-5 h-5" />
					</button>
				</div>
			</div>
		</header>

		<Sidebar libraryId={currentLibrary} isOpen={sidebarOpen} onClose={closeSidebar} />

		<main class="lg:pl-20 min-h-screen bg-gray-50 dark:bg-gray-950" style="padding-top: var(--header-height);">
			{@render children()}
		</main>
	</div>
{/if}
