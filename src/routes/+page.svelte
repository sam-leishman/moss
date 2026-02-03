<script lang="ts">
	import LibraryManager from '$lib/components/LibraryManager.svelte';
	import PersonManager from '$lib/components/PersonManager.svelte';
	import { goto } from '$app/navigation';
	import type { Library } from '$lib/server/db';
	import { setLastLibraryId } from '$lib/utils/storage';

	function handleLibraryChange(library: Library | null) {
		if (library) {
			setLastLibraryId(library.id);
			goto(`/libraries/${library.id}`);
		}
	}
</script>

<div class="px-6 py-6 max-w-screen-2xl mx-auto space-y-12">
	<!-- Libraries Section -->
	<section>
		<div class="mb-6">
			<h2 class="text-3xl font-bold text-gray-900 dark:text-white">Libraries</h2>
			<p class="mt-2 text-gray-600 dark:text-gray-400">Select or create a library to get started</p>
		</div>
		
		<LibraryManager onLibraryChange={handleLibraryChange} />
	</section>

	<!-- People Section -->
	<section>
		<div class="mb-6">
			<h2 class="text-3xl font-bold text-gray-900 dark:text-white">All People</h2>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				Manage all people across all libraries
			</p>
		</div>

		<PersonManager />
	</section>
</div>
