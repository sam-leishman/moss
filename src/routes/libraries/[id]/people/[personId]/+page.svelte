<script lang="ts">
	import { page } from '$app/stores';
	import { User, Upload, X } from 'lucide-svelte';
	import type { Person, ArtistProfile, PerformerProfile, Media, Library } from '$lib/server/db';
	import type { MediaType } from '$lib/server/security';
	import MediaGrid from '$lib/components/MediaGrid.svelte';
	import MediaList from '$lib/components/MediaList.svelte';
	import MediaFilters from '$lib/components/MediaFilters.svelte';
	import MediaDetailModal from '$lib/components/MediaDetailModal.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import BulkEditingPanel from '$lib/components/BulkEditingPanel.svelte';
	import { Check, Film, Clapperboard, Image } from 'lucide-svelte';
	import { basename } from '$lib/utils/path';
	import { fetchPersonLibraries } from '$lib/utils/api';

	let person = $state<Person | null>(null);
	let profile = $state<ArtistProfile | PerformerProfile | null>(null);
	let mediaItems = $state<Media[]>([]);
	let totalItems = $state(0);
	let totalMediaCount = $state(0);
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
	let likedOnly = $state(false);
	let bulkSelectMode = $state(false);
	let failedThumbnails = $state(new Set<number>());
	let selectedMediaIds = $state<Set<number>>(new Set());
	let showBulkEditPanel = $state(false);
	let lastSelectedIndex = $state<number | null>(null);
	let showSelectAllPagesBanner = $state(false);
	let isSelectingAllPages = $state(false);
	let selectAllPagesError = $state<string | null>(null);
	let uploadingImage = $state(false);
	let imageUploadError = $state<string | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	const MAX_BULK_SELECT_ITEMS = 10000;

	const personId = $derived($page.params.personId!);
	const libraryId = $derived.by(() => {
		const id = parseInt($page.params.id!);
		if (isNaN(id)) {
			error = 'Invalid library ID';
			return 0;
		}
		return id;
	});

	const resetSelectionState = () => {
		selectedMediaIds = new Set();
		lastSelectedIndex = null;
		showSelectAllPagesBanner = false;
		selectAllPagesError = null;
	};

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

			if (likedOnly) {
				params.append('liked', 'true');
			}

			const response = await fetch(`/api/people/${personId}/media?${params}`);
			
			if (!response.ok) {
				throw new Error('Failed to fetch media');
			}

			const data = await response.json();
			mediaItems = data.items;
			if (totalMediaCount === 0) {
				totalMediaCount = data.total;
			}
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

	// Track filter state changes and reload media
	$effect(() => {
		if (personId) {
			loadMedia();
		}
	});

	const handleSearchChange = (value: string) => {
		searchQuery = value;
		currentPage = 1;
		resetSelectionState();
	};

	const handleMediaTypeChange = (value: MediaType | 'all') => {
		mediaType = value;
		currentPage = 1;
		resetSelectionState();
	};

	const handleViewModeChange = (value: 'grid' | 'list') => {
		viewMode = value;
	};

	const handleTagsChange = (tags: number[]) => {
		selectedTags = tags;
		currentPage = 1;
		resetSelectionState();
	};

	const handlePeopleChange = (people: number[]) => {
		selectedPeople = people;
		currentPage = 1;
		resetSelectionState();
	};

	const handleLikedOnlyChange = (liked: boolean) => {
		likedOnly = liked;
		currentPage = 1;
		resetSelectionState();
	};

	const handlePageChange = (page: number) => {
		currentPage = page;
		resetSelectionState();
	};

	const handleMediaClick = (media: Media) => {
		selectedMedia = media;
	};

	const closeMediaModal = () => {
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

	const toggleBulkSelect = () => {
		bulkSelectMode = !bulkSelectMode;
		if (!bulkSelectMode) {
			resetSelectionState();
			showBulkEditPanel = false;
		}
	};

	const toggleMediaSelection = (mediaId: number, shiftKey: boolean = false) => {
		const currentIndex = mediaItems.findIndex(item => item.id === mediaId);
		
		if (shiftKey && lastSelectedIndex !== null && currentIndex !== -1) {
			const newSet = new Set(selectedMediaIds);
			const start = Math.min(lastSelectedIndex, currentIndex);
			const end = Math.max(lastSelectedIndex, currentIndex);
			
			const shouldSelect = !selectedMediaIds.has(mediaId);
			
			for (let i = start; i <= end; i++) {
				if (shouldSelect) {
					newSet.add(mediaItems[i].id);
				} else {
					newSet.delete(mediaItems[i].id);
				}
			}
			
			selectedMediaIds = newSet;
			lastSelectedIndex = currentIndex;
		} else {
			const newSet = new Set(selectedMediaIds);
			if (newSet.has(mediaId)) {
				newSet.delete(mediaId);
			} else {
				newSet.add(mediaId);
			}
			selectedMediaIds = newSet;
			if (currentIndex !== -1) {
				lastSelectedIndex = currentIndex;
			}
		}
	};

	const selectAll = () => {
		selectedMediaIds = new Set(mediaItems.map(item => item.id));
		lastSelectedIndex = mediaItems.length > 0 ? mediaItems.length - 1 : null;
		if (totalPages > 1) {
			showSelectAllPagesBanner = true;
		}
	};

	const selectAllPages = async () => {
		if (totalItems > MAX_BULK_SELECT_ITEMS) {
			selectAllPagesError = `Cannot select more than ${MAX_BULK_SELECT_ITEMS.toLocaleString()} items at once. Please use filters to narrow your selection.`;
			return;
		}

		isSelectingAllPages = true;
		selectAllPagesError = null;

		try {
			const params = new URLSearchParams({
				page: '1',
				page_size: totalItems.toString()
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
				throw new Error('Failed to load all items');
			}

			const result = await response.json();
			selectedMediaIds = new Set(result.items.map((item: Media) => item.id));
			showSelectAllPagesBanner = false;
		} catch (err) {
			selectAllPagesError = err instanceof Error ? err.message : 'Failed to select all items. Please try again.';
		} finally {
			isSelectingAllPages = false;
		}
	};

	const deselectAll = () => {
		resetSelectionState();
	};

	const handleBulkEditComplete = async () => {
		await loadMedia();
	};

	const handleBulkEditClose = () => {
		showBulkEditPanel = false;
		bulkSelectMode = false;
		resetSelectionState();
	};

	const formatStyleLabel = (style: string | null): string => {
		if (!style) return 'Not specified';
		return style.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
	};

	const calculateAge = (birthday: string): number | null => {
		if (!birthday) return null;
		
		const birthDate = new Date(birthday);
		const today = new Date();
		
		// Check if birthday is valid
		if (isNaN(birthDate.getTime())) return null;
		
		// Check if birthday is in the future
		if (birthDate > today) return null;
		
		let age = today.getFullYear() - birthDate.getFullYear();
		const monthDiff = today.getMonth() - birthDate.getMonth();
		
		// Adjust age if birthday hasn't occurred yet this year
		if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
			age--;
		}
		
		return age;
	};

	const handleImageUpload = async (event: Event) => {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		
		if (!file || !person) return;

		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			imageUploadError = 'Image must be smaller than 10MB';
			return;
		}

		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			imageUploadError = 'Only JPEG, PNG, and WebP images are allowed';
			return;
		}

		uploadingImage = true;
		imageUploadError = null;

		try {
			const formData = new FormData();
			formData.append('image', file);

			const response = await fetch(`/api/people/${personId}/image`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to upload image');
			}

			await loadPerson();
		} catch (err) {
			imageUploadError = err instanceof Error ? err.message : 'Failed to upload image';
		} finally {
			uploadingImage = false;
			if (input) input.value = '';
		}
	};

	const handleDeleteImage = async () => {
		if (!person || !confirm('Are you sure you want to delete this image?')) return;

		uploadingImage = true;
		imageUploadError = null;

		try {
			const response = await fetch(`/api/people/${personId}/image`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to delete image');
			}

			await loadPerson();
		} catch (err) {
			imageUploadError = err instanceof Error ? err.message : 'Failed to delete image';
		} finally {
			uploadingImage = false;
		}
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
		<!-- Person Info Header -->
		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
			
			<!-- Content -->
			<div class="relative p-8">
				<div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
					<!-- Profile Image -->
					<div class="relative flex-shrink-0 self-center">
						<div class="relative group">
								<div class="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
								{#if person.image_path}
									<img 
										src="/api/images/people/{person.image_path}?v={new Date(person.updated_at).getTime()}" 
										alt={person.name} 
										class="w-full h-full object-cover"
									/>
								{:else}
									<User class="w-16 h-16 text-gray-400 dark:text-gray-500" />
								{/if}
							</div>
							<!-- Image Controls Overlay -->
								<div class="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
								<input
									type="file"
									accept="image/jpeg,image/jpg,image/png,image/webp"
									onchange={handleImageUpload}
									class="hidden"
									bind:this={fileInputRef}
									disabled={uploadingImage}
								/>
								<button
									type="button"
									onclick={() => fileInputRef?.click()}
									class="p-1.5 bg-white dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
									title="Upload image"
									disabled={uploadingImage}
								>
									<Upload class="w-5 h-5 text-gray-700 dark:text-gray-300" />
								</button>
								{#if person.image_path}
									<button
										type="button"
										onclick={handleDeleteImage}
										class="p-1.5 bg-white dark:bg-gray-800 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
										title="Delete image"
										disabled={uploadingImage}
									>
										<X class="w-5 h-5 text-red-600 dark:text-red-400" />
									</button>
								{/if}
							</div>
						</div>
					</div>
					
					<!-- Person Details -->
					<div class="flex-1 text-center sm:text-left">
						<div class="mb-4">
						<div class="flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-4">
							<h1 class="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{person.name}</h1>
							<div class="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
								<span class="text-sm font-medium text-blue-800 dark:text-blue-200 capitalize">{person.role}</span>
							</div>
						</div>
					</div>
						
						<!-- Profile Information -->
						{#if person.role === 'artist' && profile}
							<div class="flex flex-wrap gap-3 justify-center sm:justify-start">
								<div class="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
									<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Style:</span>
									<span class="ml-2 text-sm text-gray-900 dark:text-gray-100">{formatStyleLabel((profile as ArtistProfile).style)}</span>
								</div>
							</div>
						{:else if person.role === 'performer' && profile}
							<div class="flex flex-wrap gap-3 justify-center sm:justify-start">
								{#if (profile as PerformerProfile).birthday}
									{@const age = calculateAge((profile as PerformerProfile).birthday!)}
									{#if age !== null}
										<div class="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
											<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Age:</span>
											<span class="ml-2 text-sm text-gray-900 dark:text-gray-100">{age}</span>
										</div>
									{/if}
								{/if}
								{#if (profile as PerformerProfile).gender}
									<div class="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
										<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Gender:</span>
										<span class="ml-2 text-sm text-gray-900 dark:text-gray-100 capitalize">{(profile as PerformerProfile).gender}</span>
									</div>
								{/if}
							</div>
						{/if}
						
						<!-- Media Count -->
						<div class="mt-4">
							<div class="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
								<span class="text-xs font-medium text-gray-600 dark:text-gray-400">{totalMediaCount} media {totalMediaCount === 1 ? 'item' : 'items'}</span>
							</div>
						</div>
					</div>
				</div>
				
				<!-- Upload Status Messages -->
				{#if imageUploadError || uploadingImage}
					<div class="mt-6 space-y-2">
						{#if imageUploadError}
							<div class="p-3 bg-red-50/90 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 backdrop-blur-sm">
								{imageUploadError}
							</div>
						{/if}
						{#if uploadingImage}
							<div class="p-3 bg-blue-50/90 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl text-sm text-blue-700 dark:text-blue-300 backdrop-blur-sm flex items-center gap-2">
								<div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
								Uploading image...
							</div>
						{/if}
					</div>
				{/if}
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

		<div class="px-6 pt-6">
			<MediaFilters
				searchQuery={searchQuery}
				mediaType={mediaType}
				viewMode={viewMode}
				selectedTags={selectedTags}
				selectedPeople={selectedPeople}
				likedOnly={likedOnly}
				libraryId={libraryId}
				personId={parseInt(personId)}
				onSearchChange={handleSearchChange}
				onMediaTypeChange={handleMediaTypeChange}
				onViewModeChange={handleViewModeChange}
				onTagsChange={handleTagsChange}
				onPeopleChange={handlePeopleChange}
				onLikedOnlyChange={handleLikedOnlyChange}
			/>
		</div>

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
					<p class="mt-2 text-sm">This person has no credited media in this library yet</p>
				</div>
			{:else}
				<div class="space-y-6">
					{#if selectAllPagesError}
						<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center justify-between">
							<p class="text-sm text-red-800 dark:text-red-200">
								{selectAllPagesError}
							</p>
							<button
								type="button"
								onclick={() => selectAllPagesError = null}
								class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
								aria-label="Dismiss"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/if}

					{#if showSelectAllPagesBanner}
						<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
							<p class="text-sm text-blue-900 dark:text-blue-100">
								All <span class="font-medium">{mediaItems.length}</span> items on this page are selected.
								<button
									type="button"
									onclick={selectAllPages}
									disabled={isSelectingAllPages}
									class="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{#if isSelectingAllPages}
										Selecting...
									{:else}
										Select all {totalItems.toLocaleString()} items
									{/if}
								</button>
								across all pages.
							</p>
							<button
								type="button"
								onclick={() => {
									showSelectAllPagesBanner = false;
									isSelectingAllPages = false;
								}}
								class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
								aria-label="Dismiss"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/if}

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-4">
							<p class="text-sm text-gray-600 dark:text-gray-400">
								Showing {mediaItems.length} of {totalItems} items
							</p>
							{#if bulkSelectMode}
								<p class="text-sm font-medium text-blue-600">
									{selectedMediaIds.size} selected
								</p>
								<button
									type="button"
									onclick={selectAll}
									class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
								>
									Select All
								</button>
								<button
									type="button"
									onclick={deselectAll}
									class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
								>
									Deselect All
								</button>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							{#if bulkSelectMode && selectedMediaIds.size > 0}
								<button
									type="button"
									onclick={() => showBulkEditPanel = true}
									class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
								>
									Edit Selected
								</button>
							{/if}
							<button
								type="button"
								onclick={toggleBulkSelect}
								class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors {bulkSelectMode ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}"
							>
								{bulkSelectMode ? 'Cancel Selection' : 'Bulk Select'}
							</button>
						</div>
					</div>

					{#if bulkSelectMode}
						<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
							{#each mediaItems as media (media.id)}
								<div class="relative group">
									<button
										type="button"
										onclick={(e) => toggleMediaSelection(media.id, e.shiftKey)}
										class="w-full aspect-square rounded-lg overflow-hidden border-2 transition-all {selectedMediaIds.has(media.id) ? 'border-blue-600 ring-2 ring-blue-600' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}"
									>
										{#if failedThumbnails.has(media.id)}
											<div class="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
												{#if media.media_type === 'video'}
													<Film class="w-10 h-10 text-gray-400 dark:text-gray-500" />
												{:else if media.media_type === 'animated'}
													<Clapperboard class="w-10 h-10 text-gray-400 dark:text-gray-500" />
												{:else}
													<Image class="w-10 h-10 text-gray-400 dark:text-gray-500" />
												{/if}
											</div>
										{:else}
											<img
												src="/api/media/{media.id}/thumbnail?v={media.updated_at}"
												alt={media.title || basename(media.path)}
												class="w-full h-full object-cover"
												onerror={() => { failedThumbnails.add(media.id); failedThumbnails = failedThumbnails; }}
											/>
										{/if}
									</button>
									{#if selectedMediaIds.has(media.id)}
										<div class="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
											<Check class="w-4 h-4 text-white" />
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
{/if}

{#if selectedMedia}
	<MediaDetailModal 
		media={selectedMedia} 
		onClose={closeMediaModal}
		currentIndex={selectedMediaIndex >= 0 ? selectedMediaIndex : undefined}
		totalItems={mediaItems.length > 0 ? mediaItems.length : undefined}
		onNext={handleNextMedia}
		onPrevious={handlePreviousMedia}
		onMediaUpdate={handleMediaUpdate}
	/>
{/if}

{#if showBulkEditPanel}
	<BulkEditingPanel
		selectedCount={selectedMediaIds.size}
		selectedMediaIds={Array.from(selectedMediaIds)}
		onComplete={handleBulkEditComplete}
		onClose={handleBulkEditClose}
	/>
{/if}
