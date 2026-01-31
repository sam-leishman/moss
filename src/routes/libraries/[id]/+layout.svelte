<script lang="ts">
	import LibrarySwitcher from '$lib/components/LibrarySwitcher.svelte';
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';

	let { data, children }: { data: LayoutData; children: any } = $props();

	const isActive = (path: string) => {
		return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
	};
</script>

<div class="min-h-screen bg-gray-50">
	<header class="bg-white border-b border-gray-200">
		<div class="flex items-center justify-between px-6 py-4 max-w-screen-2xl mx-auto">
			<h1 class="text-2xl font-bold text-gray-900">XView</h1>
			<LibrarySwitcher currentLibrary={data.library} />
		</div>
	</header>

	<nav class="bg-white border-b border-gray-200">
		<div class="px-6 max-w-screen-2xl mx-auto">
			<div class="flex gap-6">
				<a
					href="/libraries/{data.library.id}"
					class="px-1 py-4 text-sm font-medium border-b-2 transition-colors {isActive(`/libraries/${data.library.id}`) && !$page.url.pathname.includes('/tags') && !$page.url.pathname.includes('/people') ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}"
				>
					Media
				</a>
				<a
					href="/libraries/{data.library.id}/tags"
					class="px-1 py-4 text-sm font-medium border-b-2 transition-colors {isActive(`/libraries/${data.library.id}/tags`) ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}"
				>
					Tags
				</a>
				<a
					href="/libraries/{data.library.id}/people"
					class="px-1 py-4 text-sm font-medium border-b-2 transition-colors {isActive(`/libraries/${data.library.id}/people`) ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}"
				>
					People
				</a>
			</div>
		</div>
	</nav>

	<main class="px-6 py-6 max-w-screen-2xl mx-auto">
		{@render children()}
	</main>
</div>
