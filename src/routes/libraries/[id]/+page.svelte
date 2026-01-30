<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="text-center text-gray-500 py-20">
	<h2 class="text-lg font-medium text-gray-900 mb-2">{data.library.name}</h2>
	<p>Media browsing will be implemented in Phase 3</p>
</div>
