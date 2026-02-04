<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getLastLibraryId } from '$lib/utils/storage';
	import { authStore } from '$lib/stores/auth.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let loading = $state(true);

	onMount(async () => {
		const libraries = data.libraries || [];
		
		// If no libraries exist
		if (libraries.length === 0) {
			// Admins can create libraries, non-admins have no access
			if (authStore.isAdmin) {
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto('/libraries/create');
			} else {
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto('/no-access');
			}
			return;
		}
		
		// Check for last-used library in localStorage
		const lastLibraryId = getLastLibraryId();
		
		// If we have a last-used library, verify user has access to it
		if (lastLibraryId) {
			const library = libraries.find((lib: { id: number }) => lib.id === lastLibraryId);
			if (library) {
				// User has access to this library (it's in their accessible libraries list)
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(`/libraries/${lastLibraryId}`);
				return;
			}
		}
		
		// Otherwise, redirect to the first accessible library
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(`/libraries/${libraries[0].id}`);
	});
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
	</div>
{/if}
