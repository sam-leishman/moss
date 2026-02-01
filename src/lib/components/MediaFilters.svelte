<script lang="ts">
	import type { MediaType } from '$lib/server/security';
	import type { Tag } from '$lib/server/db';
	import { Search, Grid3x3, List, Tag as TagIcon, X } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		searchQuery: string;
		mediaType: MediaType | 'all';
		viewMode: 'grid' | 'list';
		selectedTags: number[];
		libraryId: number;
		onSearchChange: (query: string) => void;
		onMediaTypeChange: (type: MediaType | 'all') => void;
		onViewModeChange: (mode: 'grid' | 'list') => void;
		onTagsChange: (tagIds: number[]) => void;
	}

	let { 
		searchQuery, 
		mediaType, 
		viewMode,
		selectedTags,
		libraryId,
		onSearchChange, 
		onMediaTypeChange, 
		onViewModeChange,
		onTagsChange
	}: Props = $props();

	let allTags = $state<Tag[]>([]);
	let showTagDropdown = $state(false);
	let tagsLoading = $state(false);

	const loadTags = async () => {
		tagsLoading = true;
		try {
			const response = await fetch(`/api/tags?library_id=${libraryId}`);
			if (response.ok) {
				allTags = await response.json();
			}
		} catch (err) {
			console.error('Failed to load tags:', err);
		} finally {
			tagsLoading = false;
		}
	};

	onMount(() => {
		loadTags();
	});

	const handleSearchInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		onSearchChange(target.value);
	};

	const handleMediaTypeChange = (e: Event) => {
		const target = e.target as HTMLSelectElement;
		onMediaTypeChange(target.value as MediaType | 'all');
	};

	const toggleTag = (tagId: number) => {
		if (selectedTags.includes(tagId)) {
			onTagsChange(selectedTags.filter(id => id !== tagId));
		} else {
			onTagsChange([...selectedTags, tagId]);
		}
	};

	const removeTag = (tagId: number) => {
		onTagsChange(selectedTags.filter(id => id !== tagId));
	};

	const clearAllTags = () => {
		onTagsChange([]);
	};

	const selectedTagObjects = $derived(allTags.filter(tag => selectedTags.includes(tag.id)));
	const availableTagsForDropdown = $derived(allTags.filter(tag => !selectedTags.includes(tag.id)));
</script>

<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
	<div class="flex flex-col gap-4">
		<div class="flex flex-col sm:flex-row gap-4">
			<div class="flex-1 relative">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
				<input
					type="text"
					value={searchQuery}
					oninput={handleSearchInput}
					placeholder="Search media by title or path..."
					class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>

			<div class="flex gap-2">
			<select
				value={mediaType}
				onchange={handleMediaTypeChange}
				class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			>
				<option value="all">All Types</option>
				<option value="image">Images</option>
				<option value="video">Videos</option>
				<option value="animated">Animated</option>
			</select>

			<div class="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
				<button
					type="button"
					onclick={() => onViewModeChange('grid')}
					class="flex items-center gap-2 px-4 py-2 {viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}"
				>
					<Grid3x3 class="w-4 h-4" />
					<span>Grid</span>
				</button>
				<button
					type="button"
					onclick={() => onViewModeChange('list')}
					class="flex items-center gap-2 px-4 py-2 border-l border-gray-300 dark:border-gray-600 {viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}"
				>
					<List class="w-4 h-4" />
					<span>List</span>
				</button>
				</div>
			</div>
		</div>

		<!-- Tag Filtering -->
		<div class="flex flex-wrap items-center gap-2">
			<div class="relative">
				<button
					type="button"
					onclick={() => showTagDropdown = !showTagDropdown}
					class="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
				>
					<TagIcon class="w-4 h-4" />
					Filter by Tags
					{#if selectedTags.length > 0}
						<span class="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">{selectedTags.length}</span>
					{/if}
				</button>

				{#if showTagDropdown}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0 z-10"
						onclick={() => showTagDropdown = false}
					></div>
					<div class="absolute left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-80 overflow-y-auto">
						{#if tagsLoading}
							<div class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Loading tags...</div>
						{:else if availableTagsForDropdown.length === 0}
							<div class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
								{allTags.length === 0 ? 'No tags available' : 'All tags selected'}
							</div>
						{:else}
							{#each availableTagsForDropdown as tag (tag.id)}
								<button
									type="button"
									onclick={() => toggleTag(tag.id)}
									class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
								>
									<TagIcon class="w-3 h-3 text-gray-400 dark:text-gray-500" />
									{tag.name}
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>

			{#if selectedTagObjects.length > 0}
				{#each selectedTagObjects as tag (tag.id)}
					<div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm">
						<TagIcon class="w-3 h-3" />
						<span>{tag.name}</span>
						<button
							type="button"
							onclick={() => removeTag(tag.id)}
							class="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 transition-colors"
							aria-label="Remove tag filter"
						>
							<X class="w-3 h-3" />
						</button>
					</div>
				{/each}
				<button
					type="button"
					onclick={clearAllTags}
					class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline"
				>
					Clear all
				</button>
			{/if}
		</div>
	</div>
</div>
