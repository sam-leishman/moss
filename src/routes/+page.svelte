<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getLastLibraryId } from '$lib/utils/storage';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let loading = $state(true);

	onMount(async () => {
		const libraries = data.libraries || [];
		
		// If no libraries exist, redirect to library creation page
		if (libraries.length === 0) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto('/libraries/create');
			return;
		}
		
		// Check for last-used library in localStorage
		const lastLibraryId = getLastLibraryId();
		
		// If we have a last-used library and it exists, redirect to it
		if (lastLibraryId) {
			const libraryExists = libraries.some((lib: { id: number }) => lib.id === lastLibraryId);
			if (libraryExists) {
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(`/libraries/${lastLibraryId}`);
				return;
			}
		}
		
		// Otherwise, redirect to the first library
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(`/libraries/${libraries[0].id}`);
	});
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
	</div>
{/if}
