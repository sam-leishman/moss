<script lang="ts">
	import type { PageData } from './$types';
	import type { Media } from '$lib/server/db';
	import type { MediaType } from '$lib/server/security';
	import MediaGrid from '$lib/components/MediaGrid.svelte';
	import MediaList from '$lib/components/MediaList.svelte';
	import MediaFilters from '$lib/components/MediaFilters.svelte';
	import MediaDetailModal from '$lib/components/MediaDetailModal.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

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
</script>

<div class="flex flex-col h-full">
	<MediaFilters
		{searchQuery}
		{mediaType}
		{viewMode}
		onSearchChange={handleSearchChange}
		onMediaTypeChange={handleMediaTypeChange}
		onViewModeChange={handleViewModeChange}
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
					<p class="text-sm text-gray-600">
						Showing {mediaItems.length} of {totalItems} items
					</p>
				</div>

				{#if viewMode === 'grid'}
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
