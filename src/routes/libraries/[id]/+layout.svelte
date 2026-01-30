<script lang="ts">
	import LibrarySwitcher from '$lib/components/LibrarySwitcher.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<div class="min-h-screen bg-gray-50">
	<header class="bg-white border-b border-gray-200">
		<div class="flex items-center justify-between px-6 py-4 max-w-screen-2xl mx-auto">
			<h1 class="text-2xl font-bold text-gray-900">XView</h1>
			<LibrarySwitcher currentLibrary={data.library} />
		</div>
	</header>

	<main class="px-6 py-6 max-w-screen-2xl mx-auto">
		{@render children()}
	</main>
</div>
