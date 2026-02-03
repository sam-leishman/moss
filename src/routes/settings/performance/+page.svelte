<script lang="ts">
	import PerformancePanel from '$lib/components/PerformancePanel.svelte';
</script>

<div class="px-6 py-6">
	<div class="max-w-6xl">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Performance</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">Monitor and optimize application performance</p>
		</div>

		<PerformancePanel />
	</div>
</div>
