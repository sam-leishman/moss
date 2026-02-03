<script lang="ts">
	import { page } from '$app/stores';
	import { User } from 'lucide-svelte';
	import type { Person, ArtistProfile, PerformerProfile, Media, Library } from '$lib/server/db';
	import type { MediaType } from '$lib/server/security';
	import MediaGrid from '$lib/components/MediaGrid.svelte';
	import MediaList from '$lib/components/MediaList.svelte';
	import MediaFilters from '$lib/components/MediaFilters.svelte';
	import MediaDetailModal from '$lib/components/MediaDetailModal.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let person = $state<Person | null>(null);
	let profile = $state<ArtistProfile | PerformerProfile | null>(null);
	let mediaItems = $state<Media[]>([]);
	let totalItems = $state(0);
	let currentPage = $state(1);
	let totalPages = $state(0);
	let libraries = $state<Library[]>([]);
	
	let loading = $state(true);
	let mediaLoading = $state(false);
	let error = $state<string | null>(null);
	
	let searchQuery = $state('');
	let mediaType = $state<MediaType | 'all'>('all');
	let viewMode = $state<'grid' | 'list'>('grid');
	let selectedMedia = $state<Media | null>(null);
	let selectedTags = $state<number[]>([]);
	let selectedPeople = $state<number[]>([]);
	let selectedLibraryId = $state<number | null>(null);

	const personId = $derived($page.params.personId);

	const loadPerson = async () => {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/people/${personId}`);
			if (!response.ok) {
				if (response.status === 404) {
					error = 'Person not found';
				} else {
					throw new Error('Failed to fetch person');
				}
				return;
			}
			const data = await response.json();
			person = data.person;
			profile = data.profile;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load person';
		} finally {
			loading = false;
		}
	};

	const loadLibraries = async () => {
		if (!personId) return;
		try {
			const response = await fetch(`/api/people/${personId}/libraries`);
			if (response.ok) {
				libraries = await response.json();
			}
		} catch (err) {
			console.error('Failed to load libraries:', err);
		}
	};

	const loadMedia = async () => {
		mediaLoading = true;
		
		try {
			const params = new URLSearchParams({
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

			if (selectedPeople.length > 0) {
				params.append('person_ids', selectedPeople.join(','));
			}

			if (selectedLibraryId !== null) {
				params.append('library_id', selectedLibraryId.toString());
			}

			const response = await fetch(`/api/people/${personId}/media?${params}`);
			
			if (!response.ok) {
				throw new Error('Failed to load media');
			}

			const result = await response.json();
			mediaItems = result.items;
			totalItems = result.total;
			totalPages = result.totalPages;
		} catch (err) {
			console.error('Failed to load media:', err);
			mediaItems = [];
			totalItems = 0;
			totalPages = 0;
		} finally {
			mediaLoading = false;
		}
	};

	$effect(() => {
		loadPerson();
		loadLibraries();
	});

	$effect(() => {
		if (person) {
			loadMedia();
		}
	});

	const formatStyleLabel = (style: string | null): string => {
		if (!style) return 'Not specified';
		return style.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
	};

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

	const handlePeopleChange = (personIds: number[]) => {
		selectedPeople = personIds;
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

	const handleMediaUpdate = (updatedMedia: Media) => {
		const index = mediaItems.findIndex(item => item.id === updatedMedia.id);
		if (index >= 0) {
			mediaItems[index] = updatedMedia;
			mediaItems = [...mediaItems];
		}
		if (selectedMedia?.id === updatedMedia.id) {
			selectedMedia = updatedMedia;
		}
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

	const handleLibraryFilter = () => {
		currentPage = 1;
	};
</script>

{#if loading}
	<div class="flex items-center justify-center py-20">
		<div class="text-center">
			<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			<p class="mt-4 text-gray-600 dark:text-gray-400">Loading person...</p>
		</div>
	</div>
{:else if error}
	<div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
		{error}
	</div>
{:else if person}
	<div class="flex flex-col h-full">
		<div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
			<div class="flex items-start gap-6">
				<div class="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
					<User class="w-10 h-10 text-gray-600 dark:text-gray-400" />
				</div>
				<div class="flex-1">
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{person.name}</h1>
					<p class="text-lg text-gray-600 dark:text-gray-400 capitalize mb-4">{person.role}</p>
					
					{#if person.role === 'artist' && profile}
						<div class="space-y-2">
							<div>
								<span class="text-sm font-medium text-gray-500 dark:text-gray-400">Style:</span>
								<span class="ml-2 text-gray-900 dark:text-gray-100">{formatStyleLabel((profile as ArtistProfile).style)}</span>
							</div>
						</div>
					{:else if person.role === 'performer' && profile}
						<div class="space-y-2">
							{#if (profile as PerformerProfile).age !== null}
								<div>
									<span class="text-sm font-medium text-gray-500 dark:text-gray-400">Age:</span>
									<span class="ml-2 text-gray-900 dark:text-gray-100">{(profile as PerformerProfile).age}</span>
								</div>
							{/if}
						</div>
					{/if}

					<div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
						<p>{totalItems} media {totalItems === 1 ? 'item' : 'items'}</p>
					</div>
				</div>
			</div>
		</div>

		{#if libraries.length > 1}
			<div class="flex items-center gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
				<label for="library-filter" class="text-sm font-medium text-gray-700 dark:text-gray-300">Library:</label>
				<select
					id="library-filter"
					bind:value={selectedLibraryId}
					onchange={handleLibraryFilter}
					class="pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value={null}>All Libraries</option>
					{#each libraries as library (library.id)}
						<option value={library.id}>{library.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<MediaFilters
			{searchQuery}
			{mediaType}
			{viewMode}
			{selectedTags}
			{selectedPeople}
			libraryId={selectedLibraryId || 0}
			personId={person ? person.id : undefined}
			onSearchChange={handleSearchChange}
			onMediaTypeChange={handleMediaTypeChange}
			onViewModeChange={handleViewModeChange}
			onTagsChange={handleTagsChange}
			onPeopleChange={handlePeopleChange}
		/>

		<div class="flex-1 overflow-y-auto p-6">
			{#if mediaLoading}
				<div class="flex items-center justify-center py-20">
					<div class="text-center">
						<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
						<p class="mt-4 text-gray-600 dark:text-gray-400">Loading media...</p>
					</div>
				</div>
			{:else if mediaItems.length === 0}
				<div class="text-center py-20 text-gray-500 dark:text-gray-400">
					<p class="text-lg">No media found</p>
					{#if searchQuery || mediaType !== 'all' || selectedTags.length > 0 || selectedPeople.length > 0 || selectedLibraryId !== null}
						<p class="mt-2 text-sm">Try adjusting your filters</p>
					{:else}
						<p class="mt-2 text-sm">This person has no credited media yet</p>
					{/if}
				</div>
			{:else}
				<div class="space-y-6">
					<div class="flex items-center justify-between">
						<p class="text-sm text-gray-600 dark:text-gray-400">
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
		onMediaUpdate={handleMediaUpdate}
	/>
{/if}
