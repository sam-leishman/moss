<script lang="ts">
	import { BarChart3, TrendingUp, Tag, Users, Image, Video, Film, FileQuestion, Award } from 'lucide-svelte';
	import type { LibraryStatistics } from '../../routes/api/statistics/+server';
	import type { Library } from '$lib/server/db';
	import { formatBytes, formatDate } from '$lib/utils/format';

	interface StatisticsPanelProps {
		currentLibraryId?: number | null;
	}

	let { currentLibraryId = null }: StatisticsPanelProps = $props();

	let statistics = $state<LibraryStatistics | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let libraries = $state<Library[]>([]);
	let selectedLibraryId = $state<number | null>(null);
	let previousLibraryId = $state<number | null | undefined>(undefined);
	let initialized = $state(false);

	$effect(() => {
		if (!initialized && currentLibraryId !== undefined) {
			selectedLibraryId = currentLibraryId;
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

	const loadStatistics = async () => {
		isLoading = true;
		error = null;

		try {
			const url = selectedLibraryId 
				? `/api/statistics?library_id=${selectedLibraryId}`
				: '/api/statistics';
			
			const response = await fetch(url);
			
			if (!response.ok) {
				throw new Error('Failed to load statistics');
			}

			const result = await response.json();
			statistics = result.statistics;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			statistics = null;
		} finally {
			isLoading = false;
		}
	};

	$effect(() => {
		loadLibraries();
	});

	$effect(() => {
		// Track selectedLibraryId changes
		if (selectedLibraryId !== previousLibraryId) {
			previousLibraryId = selectedLibraryId;
			loadStatistics();
		}
	});

</script>

<div class="space-y-6">
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				<p class="mt-4 text-gray-600 dark:text-gray-400">Loading statistics...</p>
			</div>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200">{error}</p>
			<button
				type="button"
				onclick={loadStatistics}
				class="mt-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
			>
				Retry
			</button>
		</div>
	{:else if statistics}
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Library Statistics</h2>
				<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{statistics.libraryName}</p>
			</div>
			<div class="flex items-center gap-3">
				<select
					bind:value={selectedLibraryId}
					class="pl-3 pr-10 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value={null}>All Libraries</option>
					{#each libraries as library}
						<option value={library.id}>{library.name}</option>
					{/each}
				</select>
				<button
					type="button"
					onclick={loadStatistics}
					class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					Refresh
				</button>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
						<BarChart3 class="w-6 h-6 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Total Media</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{statistics.totalMedia.toLocaleString()}</p>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
						<Tag class="w-6 h-6 text-green-600 dark:text-green-400" />
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Total Tags</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{statistics.totalTags.toLocaleString()}</p>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
						<Users class="w-6 h-6 text-purple-600 dark:text-purple-400" />
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Total People</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{statistics.totalPeople.toLocaleString()}</p>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
						<TrendingUp class="w-6 h-6 text-amber-600 dark:text-amber-400" />
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Total Size</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{formatBytes(statistics.totalSize)}</p>
					</div>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
					<Image class="w-5 h-5" />
					Media by Type
				</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Image class="w-4 h-4 text-gray-600 dark:text-gray-400" />
							<span class="text-sm text-gray-700 dark:text-gray-300">Images</span>
						</div>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{statistics.mediaByType.image.toLocaleString()}</span>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Video class="w-4 h-4 text-gray-600 dark:text-gray-400" />
							<span class="text-sm text-gray-700 dark:text-gray-300">Videos</span>
						</div>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{statistics.mediaByType.video.toLocaleString()}</span>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Film class="w-4 h-4 text-gray-600 dark:text-gray-400" />
							<span class="text-sm text-gray-700 dark:text-gray-300">Animated</span>
						</div>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{statistics.mediaByType.animated.toLocaleString()}</span>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
					<TrendingUp class="w-5 h-5" />
					Averages
				</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-700 dark:text-gray-300">Tags per Media</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{statistics.averageTagsPerMedia}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-700 dark:text-gray-300">Credits per Media</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{statistics.averageCreditsPerMedia}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-700 dark:text-gray-300">Average File Size</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{formatBytes(statistics.averageSize)}</span>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
					<FileQuestion class="w-5 h-5" />
					Untagged Content
				</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-700 dark:text-gray-300">Media without Tags</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{statistics.mediaWithoutTags.toLocaleString()}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-700 dark:text-gray-300">Media without Credits</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{statistics.mediaWithoutCredits.toLocaleString()}</span>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
					<TrendingUp class="w-5 h-5" />
					Timeline
				</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-700 dark:text-gray-300">Oldest Media</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{formatDate(statistics.oldestMedia)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-700 dark:text-gray-300">Newest Media</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{formatDate(statistics.newestMedia)}</span>
					</div>
				</div>
			</div>
		</div>

		{#if statistics.topTags.length > 0}
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
					<Award class="w-5 h-5" />
					Top Tags
				</h3>
				<div class="space-y-2">
					{#each statistics.topTags as tag, index}
						<div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
							<div class="flex items-center gap-3">
								<span class="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">#{index + 1}</span>
								<span class="text-sm text-gray-900 dark:text-white">{tag.name}</span>
							</div>
							<span class="text-sm font-medium text-blue-600 dark:text-blue-400">{tag.count.toLocaleString()} items</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if statistics.topPeople.length > 0}
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
					<Award class="w-5 h-5" />
					Top People
				</h3>
				<div class="space-y-2">
					{#each statistics.topPeople as person, index}
						<div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
							<div class="flex items-center gap-3">
								<span class="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">#{index + 1}</span>
								<div>
									<span class="text-sm text-gray-900 dark:text-white">{person.name}</span>
									<span class="ml-2 text-xs text-gray-500 dark:text-gray-400 capitalize">({person.role})</span>
								</div>
							</div>
							<span class="text-sm font-medium text-purple-600 dark:text-purple-400">{person.count.toLocaleString()} credits</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
