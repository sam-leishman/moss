<script lang="ts">
	import TagManager from '$lib/components/TagManager.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="max-w-4xl">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Tag Management</h2>
		<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Create and manage tags for organizing your media library</p>
	</div>

	<TagManager />
</div>
