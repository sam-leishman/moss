<script lang="ts">
	import { page } from '$app/stores';
	import { Image, Tag, Users, Settings, Home, Wrench } from 'lucide-svelte';

	interface SidebarProps {
		libraryId: number | null;
		isOpen?: boolean;
		onClose?: () => void;
	}

	let { libraryId, isOpen = true, onClose }: SidebarProps = $props();

	const isActive = (path: string) => {
		return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
	};

	// Define known sub-routes for cleaner active state logic
	const subRoutes = ['/tags', '/people', '/manage'];
	
	const isMediaActive = $derived(() => {
		if (!libraryId) return false;
		const path = $page.url.pathname;
		const baseLibraryPath = `/libraries/${libraryId}`;
		
		// Exact match
		if (path === baseLibraryPath) return true;
		
		// If we're in the library but not in any known sub-route
		if (path.startsWith(baseLibraryPath + '/')) {
			return !subRoutes.some(route => path.startsWith(baseLibraryPath + route));
		}
		
		return false;
	});

	// Global navigation items (always visible)
	const globalNavItems = $derived([
		{
			href: '/',
			label: 'Home',
			icon: Home,
			isActive: $page.url.pathname === '/'
		},
		{
			href: '/settings',
			label: 'Settings',
			icon: Settings,
			isActive: isActive('/settings')
		}
	]);

	// Library-specific navigation items (only when in library context)
	const libraryNavItems = $derived(libraryId ? [
		{
			href: `/libraries/${libraryId}`,
			label: 'Media',
			icon: Image,
			isActive: isMediaActive()
		},
		{
			href: `/libraries/${libraryId}/tags`,
			label: 'Tags',
			icon: Tag,
			isActive: isActive(`/libraries/${libraryId}/tags`)
		},
		{
			href: `/libraries/${libraryId}/people`,
			label: 'People',
			icon: Users,
			isActive: isActive(`/libraries/${libraryId}/people`)
		},
		{
			href: `/libraries/${libraryId}/manage`,
			label: 'Manage',
			icon: Wrench,
			isActive: isActive(`/libraries/${libraryId}/manage`)
		}
	] : []);
</script>

<!-- Mobile overlay -->
{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onclick={() => onClose?.()}
		class="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
		aria-hidden="true"
	></div>
{/if}

<!-- Sidebar -->
<aside
	class="fixed left-0 bottom-0 w-20 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-40 transition-transform duration-300 lg:translate-x-0 {isOpen ? 'translate-x-0' : '-translate-x-full'}"
	style="top: var(--header-height);"
>
	<nav class="flex flex-col h-full py-4">
		<!-- Global Navigation -->
		{#each globalNavItems as item}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center gap-1 py-4 px-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {item.isActive ? 'text-blue-600 dark:text-white bg-blue-50 dark:bg-gray-800 border-l-4 border-blue-600 dark:border-blue-500' : ''}"
			>
				<item.icon class="w-6 h-6" />
				<span class="text-xs font-medium">{item.label}</span>
			</a>
		{/each}

		<!-- Divider if we have library items -->
		{#if libraryId && libraryNavItems.length > 0}
			<div class="my-2 mx-3 border-t border-gray-200 dark:border-gray-700"></div>
		{/if}

		<!-- Library Navigation -->
		{#each libraryNavItems as item}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center gap-1 py-4 px-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {item.isActive ? 'text-blue-600 dark:text-white bg-blue-50 dark:bg-gray-800 border-l-4 border-blue-600 dark:border-blue-500' : ''}"
			>
				<item.icon class="w-6 h-6" />
				<span class="text-xs font-medium">{item.label}</span>
			</a>
		{/each}
	</nav>
</aside>
