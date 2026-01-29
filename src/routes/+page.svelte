<script lang="ts">
	import LibrarySwitcher from '$lib/components/LibrarySwitcher.svelte';
	import { currentLibrary } from '$lib/stores/library';
	import type { Library } from '$lib/server/db';

	function handleLibraryChange(library: Library | null) {
		currentLibrary.set(library);
	}
</script>

<div class="min-h-screen bg-gray-50">
	<header class="bg-white border-b border-gray-200">
		<div class="flex items-center justify-between px-6 py-4 max-w-screen-2xl mx-auto">
			<h1 class="text-2xl font-bold text-gray-900">XView</h1>
			<LibrarySwitcher onLibraryChange={handleLibraryChange} />
		</div>
	</header>

	<main class="px-6 py-6 max-w-screen-2xl mx-auto">
		{#if $currentLibrary}
			<div class="animate-fade-in">
				<div class="text-center text-gray-500 py-20">
					<p>Media browsing will be implemented in Phase 3</p>
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-center py-20">
				<p class="text-gray-500">Select or create a library to get started</p>
			</div>
		{/if}
	</main>
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in {
		animation: fadeIn 0.3s ease-in;
	}
</style>
