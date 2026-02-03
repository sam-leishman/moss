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
	import { fetchPersonLibraries } from '$lib/utils/api';

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

	const personId = $derived($page.params.personId!);
	const libraryId = $derived.by(() => {
		const id = parseInt($page.params.id!);
		if (isNaN(id)) {
			error = 'Invalid library ID';
			return 0;
		}
		return id;
	});

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
			libraries = await fetchPersonLibraries(personId);
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
				throw new Error('Failed to fetch media');
			}

			const data = await response.json();
			mediaItems = data.items;
			totalItems = data.total;
			totalPages = data.totalPages;
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
		if (personId) {
			loadPerson();
			loadLibraries();
		}
	});

	$effect(() => {
		if (personId) {
			loadMedia();
		}
	});

	const handleSearchChange = (value: string) => {
		searchQuery = value;
		currentPage = 1;
	};

	const handleMediaTypeChange = (value: MediaType | 'all') => {
		mediaType = value;
		currentPage = 1;
	};

	const handleViewModeChange = (value: 'grid' | 'list') => {
		viewMode = value;
	};

	const handleTagsChange = (tags: number[]) => {
		selectedTags = tags;
		currentPage = 1;
	};

	const handlePeopleChange = (people: number[]) => {
		selectedPeople = people;
		currentPage = 1;
	};

	const handlePageChange = (page: number) => {
		currentPage = page;
	};

	const handleMediaClick = (media: Media) => {
		selectedMedia = media;
	};

	const closeMediaModal = () => {
		selectedMedia = null;
	};

	const formatStyleLabel = (style: string | null): string => {
		if (!style) return 'Not specified';
		return style.split('_').map(word => 
			word.charAt(0).toUpperCase() + word.slice(1)
		).join(' ');
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
					class="pl-3 pr-10 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value={null}>All Libraries</option>
					{#each libraries as lib}
						<option value={lib.id}>{lib.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="flex-1 overflow-auto">
			<div class="p-6">
				<MediaFilters
					searchQuery={searchQuery}
					mediaType={mediaType}
					viewMode={viewMode}
					selectedTags={selectedTags}
					selectedPeople={selectedPeople}
					libraryId={selectedLibraryId || 0}
					personId={parseInt(personId)}
					onSearchChange={handleSearchChange}
					onMediaTypeChange={handleMediaTypeChange}
					onViewModeChange={handleViewModeChange}
					onTagsChange={handleTagsChange}
					onPeopleChange={handlePeopleChange}
				/>

				{#if mediaLoading}
					<div class="flex items-center justify-center py-20">
						<div class="text-center">
							<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
							<p class="mt-4 text-gray-600 dark:text-gray-400">Loading media...</p>
						</div>
					</div>
				{:else if mediaItems.length === 0}
					<div class="text-center py-20">
						<p class="text-gray-500 dark:text-gray-400">No media found</p>
					</div>
				{:else}
					{#if viewMode === 'grid'}
						<MediaGrid items={mediaItems} onItemClick={handleMediaClick} />
					{:else}
						<MediaList items={mediaItems} onItemClick={handleMediaClick} />
					{/if}

					{#if totalPages > 1}
						<div class="mt-6">
							<Pagination
								currentPage={currentPage}
								totalPages={totalPages}
								onPageChange={handlePageChange}
							/>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if selectedMedia}
	<MediaDetailModal media={selectedMedia} onClose={closeMediaModal} />
{/if}
