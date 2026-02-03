<script lang="ts">
	import { page } from '$app/stores';
	import { Settings as SettingsIcon, BarChart3, Activity } from 'lucide-svelte';

	let { children } = $props();

	const isActive = (path: string) => {
		return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
	};

	const settingsNavItems = $derived([
		{
			href: '/settings/general',
			label: 'General',
			icon: SettingsIcon,
			isActive: isActive('/settings/general')
		},
		{
			href: '/settings/statistics',
			label: 'Statistics',
			icon: BarChart3,
			isActive: isActive('/settings/statistics')
		},
		{
			href: '/settings/performance',
			label: 'Performance',
			icon: Activity,
			isActive: isActive('/settings/performance')
		}
	]);
</script>

<!-- Settings Sidebar -->
<aside
	class="fixed left-0 bottom-0 w-20 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-40"
	style="top: var(--header-height);"
>
	<nav class="flex flex-col h-full py-4">
		{#each settingsNavItems as item}
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

<main class="lg:pl-20">
	{@render children()}
</main>
