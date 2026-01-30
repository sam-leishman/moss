<script lang="ts">
	import LibraryManager from '$lib/components/LibraryManager.svelte';
	import { goto } from '$app/navigation';
	import type { Library } from '$lib/server/db';

	function handleLibraryChange(library: Library | null) {
		if (library) {
			goto(`/libraries/${library.id}`);
		}
	}
</script>

<div class="min-h-screen bg-gray-50">
	<header class="bg-white border-b border-gray-200">
		<div class="flex items-center justify-between px-6 py-4 max-w-screen-2xl mx-auto">
			<h1 class="text-2xl font-bold text-gray-900">XView</h1>
		</div>
	</header>

	<main class="px-6 py-6 max-w-screen-2xl mx-auto">
		<div class="mb-6">
			<h2 class="text-xl font-semibold text-gray-900">Libraries</h2>
			<p class="text-sm text-gray-500 mt-1">Select or create a library to get started</p>
		</div>
		
		<LibraryManager onLibraryChange={handleLibraryChange} />
	</main>
</div>
