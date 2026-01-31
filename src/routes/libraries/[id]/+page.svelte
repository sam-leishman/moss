<script lang="ts">
	import type { PageData } from './$types';
	import type { Media } from '$lib/server/db';
	import type { MediaType } from '$lib/server/security';
	import MediaGrid from '$lib/components/MediaGrid.svelte';
	import MediaList from '$lib/components/MediaList.svelte';
	import MediaFilters from '$lib/components/MediaFilters.svelte';
	import MediaDetailModal from '$lib/components/MediaDetailModal.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import BulkEditingPanel from '$lib/components/BulkEditingPanel.svelte';

	let { data }: { data: PageData } = $props();

	let mediaItems = $state<Media[]>([]);
	let totalItems = $state(0);
	let currentPage = $state(1);
	let totalPages = $state(0);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	let searchQuery = $state('');
	let mediaType = $state<MediaType | 'all'>('all');
	let viewMode = $state<'grid' | 'list'>('grid');
	let selectedMedia = $state<Media | null>(null);
	let selectedTags = $state<number[]>([]);
	let bulkSelectMode = $state(false);
	let selectedMediaIds = $state<Set<number>>(new Set());
	let showBulkEditPanel = $state(false);

	const loadMedia = async () => {
		isLoading = true;
		error = null;

		try {
			const params = new URLSearchParams({
				library_id: data.library.id.toString(),
				page: currentPage.toString(),
				page_size: '50'
			});

			if (mediaType !== 'all') {
				params.append('media_type', mediaType);
			}

			if (searchQuery.trim()) {
				params.append('search', searchQuery.trim());
			}

			if (selectedTags.length > 0) {
				params.append('tag_ids', selectedTags.join(','));
			}

			const response = await fetch(`/api/media?${params}`);
			
			if (!response.ok) {
				throw new Error('Failed to load media');
			}

			const result = await response.json();
			mediaItems = result.items;
			totalItems = result.total;
			totalPages = result.totalPages;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			mediaItems = [];
			totalItems = 0;
			totalPages = 0;
		} finally {
			isLoading = false;
		}
	};

	$effect(() => {
		loadMedia();
	});

	const handleSearchChange = (query: string) => {
		searchQuery = query;
		currentPage = 1;
	};

	const handleMediaTypeChange = (type: MediaType | 'all') => {
		mediaType = type;
		currentPage = 1;
	};

	const handleTagsChange = (tagIds: number[]) => {
		selectedTags = tagIds;
		currentPage = 1;
	};

	const handleViewModeChange = (mode: 'grid' | 'list') => {
		viewMode = mode;
	};

	const handlePageChange = (page: number) => {
		currentPage = page;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const handleMediaClick = (media: Media) => {
		selectedMedia = media;
	};

	const handleCloseDetail = () => {
		selectedMedia = null;
	};

	const handleNextMedia = () => {
		const current = selectedMedia;
		if (!current) return;
		const currentIndex = mediaItems.findIndex(item => item.id === current.id);
		if (currentIndex >= 0 && currentIndex < mediaItems.length - 1) {
			selectedMedia = mediaItems[currentIndex + 1];
		}
	};

	const handlePreviousMedia = () => {
		const current = selectedMedia;
		if (!current) return;
		const currentIndex = mediaItems.findIndex(item => item.id === current.id);
		if (currentIndex > 0) {
			selectedMedia = mediaItems[currentIndex - 1];
		}
	};

	const selectedMediaIndex = $derived.by(() => {
		const current = selectedMedia;
		return current ? mediaItems.findIndex(item => item.id === current.id) : -1;
	});

	const toggleBulkSelect = () => {
		bulkSelectMode = !bulkSelectMode;
		if (!bulkSelectMode) {
			selectedMediaIds = new Set();
			showBulkEditPanel = false;
		}
	};

	const toggleMediaSelection = (mediaId: number) => {
		const newSet = new Set(selectedMediaIds);
		if (newSet.has(mediaId)) {
			newSet.delete(mediaId);
		} else {
			newSet.add(mediaId);
		}
		selectedMediaIds = newSet;
	};

	const selectAll = () => {
		selectedMediaIds = new Set(mediaItems.map(item => item.id));
	};

	const deselectAll = () => {
		selectedMediaIds = new Set();
	};

	const handleBulkEditComplete = async () => {
		await loadMedia();
	};

	const handleBulkEditClose = () => {
		showBulkEditPanel = false;
		bulkSelectMode = false;
		selectedMediaIds = new Set();
	};
</script>

<div class="flex flex-col h-full">
	<MediaFilters
		{searchQuery}
		{mediaType}
		{viewMode}
		{selectedTags}
		onSearchChange={handleSearchChange}
		onMediaTypeChange={handleMediaTypeChange}
		onViewModeChange={handleViewModeChange}
		onTagsChange={handleTagsChange}
	/>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex items-center justify-center py-20">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
					<p class="mt-4 text-gray-600">Loading media...</p>
				</div>
			</div>
		{:else if error}
			<div class="text-center py-20">
				<p class="text-red-600">{error}</p>
				<button
					type="button"
					onclick={loadMedia}
					class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
				>
					Retry
				</button>
			</div>
		{:else if mediaItems.length === 0}
			<div class="text-center py-20 text-gray-500">
				<p class="text-lg">No media found</p>
				{#if searchQuery || mediaType !== 'all'}
					<p class="mt-2 text-sm">Try adjusting your filters</p>
				{:else}
					<p class="mt-2 text-sm">Scan this library to add media files</p>
				{/if}
			</div>
		{:else}
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<p class="text-sm text-gray-600">
							Showing {mediaItems.length} of {totalItems} items
						</p>
						{#if bulkSelectMode}
							<p class="text-sm font-medium text-blue-600">
								{selectedMediaIds.size} selected
							</p>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#if bulkSelectMode && selectedMediaIds.size > 0}
							<button
								type="button"
								onclick={() => showBulkEditPanel = true}
								class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
							>
								Edit Selected
							</button>
						{/if}
						<button
							type="button"
							onclick={toggleBulkSelect}
							class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors {bulkSelectMode ? 'bg-blue-50 border-blue-600 text-blue-600' : ''}"
						>
							{bulkSelectMode ? 'Cancel Selection' : 'Bulk Select'}
						</button>
						{#if bulkSelectMode}
							<button
								type="button"
								onclick={selectAll}
								class="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 underline"
							>
								Select All
							</button>
							<button
								type="button"
								onclick={deselectAll}
								class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 underline"
							>
								Deselect All
							</button>
						{/if}
					</div>
				</div>

				{#if bulkSelectMode}
					<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
						{#each mediaItems as media (media.id)}
							<div class="relative group">
								<button
									type="button"
									onclick={() => toggleMediaSelection(media.id)}
									class="w-full aspect-square rounded-lg overflow-hidden border-2 transition-all {selectedMediaIds.has(media.id) ? 'border-blue-600 ring-2 ring-blue-600' : 'border-transparent hover:border-gray-300'}"
								>
									<img
										src="/api/media/{media.id}/thumbnail"
										alt={media.title || media.path}
										class="w-full h-full object-cover"
									/>
								</button>
								{#if selectedMediaIds.has(media.id)}
									<div class="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
										<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
										</svg>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else if viewMode === 'grid'}
					<MediaGrid items={mediaItems} onItemClick={handleMediaClick} />
				{:else}
					<MediaList items={mediaItems} onItemClick={handleMediaClick} />
				{/if}

				{#if totalPages > 1}
					<div class="pt-6">
						<Pagination
							currentPage={currentPage}
							totalPages={totalPages}
							onPageChange={handlePageChange}
						/>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<MediaDetailModal 
	media={selectedMedia} 
	onClose={handleCloseDetail}
	currentIndex={selectedMediaIndex >= 0 ? selectedMediaIndex : undefined}
	totalItems={mediaItems.length > 0 ? mediaItems.length : undefined}
	onNext={handleNextMedia}
	onPrevious={handlePreviousMedia}
/>

{#if showBulkEditPanel}
	<BulkEditingPanel
		selectedCount={selectedMediaIds.size}
		selectedMediaIds={Array.from(selectedMediaIds)}
		onComplete={handleBulkEditComplete}
		onClose={handleBulkEditClose}
	/>
{/if}
