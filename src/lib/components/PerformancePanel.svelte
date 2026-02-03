<script lang="ts">
	import { Activity, Database, Zap, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-svelte';
	import type { PerformanceMetrics } from '../../routes/api/performance/+server';
	import type { Library } from '$lib/server/db';
	import { formatBytes } from '$lib/utils/format';

	interface PerformancePanelProps {
		libraryId?: number | null;
	}

	let { libraryId = null }: PerformancePanelProps = $props();

	let metrics = $state<PerformanceMetrics | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let libraries = $state<Library[]>([]);
	let selectedLibraryId = $state<number | null>(null);
	let previousLibraryId = $state<number | null>(null);
	let initialized = $state(false);

	$effect(() => {
		if (!initialized && libraryId !== undefined) {
			selectedLibraryId = libraryId;
			initialized = true;
		}
	});

	const loadLibraries = async () => {
		try {
			const response = await fetch('/api/libraries');
			if (!response.ok) {
				throw new Error('Failed to load libraries');
			}
			const result = await response.json();
			libraries = result.libraries;
		} catch (err) {
			console.error('Failed to load libraries:', err);
		}
	};

	const loadMetrics = async () => {
		if (!selectedLibraryId) {
			error = 'Please select a library to view performance metrics';
			metrics = null;
			return;
		}

		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/performance?library_id=${selectedLibraryId}`);
			
			if (!response.ok) {
				throw new Error('Failed to load performance metrics');
			}

			const result = await response.json();
			metrics = result.metrics;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			metrics = null;
		} finally {
			isLoading = false;
		}
	};

	$effect(() => {
		loadLibraries();
	});

	$effect(() => {
		if (selectedLibraryId !== previousLibraryId) {
			previousLibraryId = selectedLibraryId;
			if (selectedLibraryId) {
				loadMetrics();
			}
		}
	});


	const getQueryPerformanceColor = (ms: number): string => {
		if (ms < 10) return 'text-green-600 dark:text-green-400';
		if (ms < 50) return 'text-blue-600 dark:text-blue-400';
		if (ms < 100) return 'text-amber-600 dark:text-amber-400';
		return 'text-red-600 dark:text-red-400';
	};

	const getQueryPerformanceLabel = (ms: number): string => {
		if (ms < 10) return 'Excellent';
		if (ms < 50) return 'Good';
		if (ms < 100) return 'Fair';
		return 'Slow';
	};
</script>

<div class="space-y-6">
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				<p class="mt-4 text-gray-600 dark:text-gray-400">Analyzing performance...</p>
			</div>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200">{error}</p>
			<button
				type="button"
				onclick={loadMetrics}
				class="mt-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
			>
				Retry
			</button>
		</div>
	{:else}
		<div class="flex items-center justify-between mb-6">
			<div>
				<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Performance Monitoring</h2>
				{#if metrics}
					<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{metrics.libraryName}</p>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				<select
					bind:value={selectedLibraryId}
					class="pl-3 pr-10 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value={null}>Select a library</option>
					{#each libraries as library}
						<option value={library.id}>{library.name}</option>
					{/each}
				</select>
				<button
					type="button"
					onclick={loadMetrics}
					disabled={!selectedLibraryId}
					class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Refresh
				</button>
			</div>
		</div>

		{#if !metrics && !error}
			<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
				<Activity class="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
				<p class="text-blue-900 dark:text-blue-100 font-medium">Select a library to view performance metrics</p>
				<p class="text-sm text-blue-700 dark:text-blue-300 mt-1">Choose a library from the dropdown above</p>
			</div>
		{/if}

		{#if metrics}

		{#if metrics.recommendations.length > 0}
			<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
				<h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
					{#if metrics.recommendations[0].includes('acceptable')}
						<CheckCircle class="w-4 h-4" />
					{:else}
						<AlertTriangle class="w-4 h-4" />
					{/if}
					Recommendations
				</h3>
				<ul class="space-y-1">
					{#each metrics.recommendations as recommendation}
						<li class="text-sm text-blue-800 dark:text-blue-200">• {recommendation}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
						<Database class="w-6 h-6 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Database Size</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{formatBytes(metrics.databaseSize)}</p>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
						<Zap class="w-6 h-6 text-green-600 dark:text-green-400" />
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Cache Size</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{formatBytes(metrics.cacheStats.cacheSize)}</p>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
						<Activity class="w-6 h-6 text-purple-600 dark:text-purple-400" />
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">WAL Mode</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{metrics.cacheStats.walMode ? 'Enabled' : 'Disabled'}</p>
					</div>
				</div>
			</div>
		</div>

		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
				<Zap class="w-5 h-5" />
				Query Performance
			</h3>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-900 dark:text-white">Media List Query</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">Standard media browsing</p>
					</div>
					<div class="text-right">
						<p class={`text-lg font-bold ${getQueryPerformanceColor(metrics.queryPerformance.mediaListQuery)}`}>
							{metrics.queryPerformance.mediaListQuery}ms
						</p>
						<p class={`text-xs ${getQueryPerformanceColor(metrics.queryPerformance.mediaListQuery)}`}>
							{getQueryPerformanceLabel(metrics.queryPerformance.mediaListQuery)}
						</p>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-900 dark:text-white">Tag Filter Query</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">Filtering by tags</p>
					</div>
					<div class="text-right">
						<p class={`text-lg font-bold ${getQueryPerformanceColor(metrics.queryPerformance.tagFilterQuery)}`}>
							{metrics.queryPerformance.tagFilterQuery}ms
						</p>
						<p class={`text-xs ${getQueryPerformanceColor(metrics.queryPerformance.tagFilterQuery)}`}>
							{getQueryPerformanceLabel(metrics.queryPerformance.tagFilterQuery)}
						</p>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-900 dark:text-white">Person Filter Query</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">Filtering by people/credits</p>
					</div>
					<div class="text-right">
						<p class={`text-lg font-bold ${getQueryPerformanceColor(metrics.queryPerformance.personFilterQuery)}`}>
							{metrics.queryPerformance.personFilterQuery}ms
						</p>
						<p class={`text-xs ${getQueryPerformanceColor(metrics.queryPerformance.personFilterQuery)}`}>
							{getQueryPerformanceLabel(metrics.queryPerformance.personFilterQuery)}
						</p>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-900 dark:text-white">Search Query</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">Text search in titles/paths</p>
					</div>
					<div class="text-right">
						<p class={`text-lg font-bold ${getQueryPerformanceColor(metrics.queryPerformance.searchQuery)}`}>
							{metrics.queryPerformance.searchQuery}ms
						</p>
						<p class={`text-xs ${getQueryPerformanceColor(metrics.queryPerformance.searchQuery)}`}>
							{getQueryPerformanceLabel(metrics.queryPerformance.searchQuery)}
						</p>
					</div>
				</div>
			</div>
		</div>

		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
				<Database class="w-5 h-5" />
				Table Statistics
			</h3>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="border-b border-gray-200 dark:border-gray-700">
						<tr>
							<th class="text-left py-2 px-3 text-gray-700 dark:text-gray-300 font-medium">Table</th>
							<th class="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-medium">Rows</th>
							<th class="text-right py-2 px-3 text-gray-700 dark:text-gray-300 font-medium">Est. Size</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
						{#each metrics.tableStats as table}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
								<td class="py-2 px-3 text-gray-900 dark:text-white font-mono text-xs">{table.tableName}</td>
								<td class="py-2 px-3 text-right text-gray-900 dark:text-white">{table.rowCount.toLocaleString()}</td>
								<td class="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatBytes(table.estimatedSize)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
				<TrendingUp class="w-5 h-5" />
				Index Health
			</h3>
			<div class="space-y-2">
				{#each metrics.indexHealth as index}
					<div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
						<div>
							<p class="text-sm font-medium text-gray-900 dark:text-white font-mono">{index.indexName}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Table: {index.tableName}</p>
						</div>
						<div class="flex items-center gap-2">
							{#if index.isHealthy}
								<CheckCircle class="w-4 h-4 text-green-600 dark:text-green-400" />
								<span class="text-sm text-green-600 dark:text-green-400">Healthy</span>
							{:else}
								<AlertTriangle class="w-4 h-4 text-red-600 dark:text-red-400" />
								<span class="text-sm text-red-600 dark:text-red-400">Issues</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
		{/if}
	{/if}
</div>
