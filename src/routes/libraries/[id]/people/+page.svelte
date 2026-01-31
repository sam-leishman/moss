<script lang="ts">
	import PersonManager from '$lib/components/PersonManager.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<PersonManager libraryId={data.library.id} />
