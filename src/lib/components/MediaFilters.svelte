<script lang="ts">
	import type { MediaType } from '$lib/server/security';

	interface Props {
		searchQuery: string;
		mediaType: MediaType | 'all';
		viewMode: 'grid' | 'list';
		onSearchChange: (query: string) => void;
		onMediaTypeChange: (type: MediaType | 'all') => void;
		onViewModeChange: (mode: 'grid' | 'list') => void;
	}

	let { 
		searchQuery, 
		mediaType, 
		viewMode, 
		onSearchChange, 
		onMediaTypeChange, 
		onViewModeChange 
	}: Props = $props();

	let searchInput = $state(searchQuery);

	$effect(() => {
		searchInput = searchQuery;
	});

	const handleSearchInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		searchInput = target.value;
	};

	const handleSearchSubmit = (e: Event) => {
		e.preventDefault();
		onSearchChange(searchInput);
	};

	const handleMediaTypeChange = (e: Event) => {
		const target = e.target as HTMLSelectElement;
		onMediaTypeChange(target.value as MediaType | 'all');
	};
</script>

<div class="bg-white border-b border-gray-200 p-4">
	<div class="flex flex-col sm:flex-row gap-4">
		<form onsubmit={handleSearchSubmit} class="flex-1">
			<div class="relative">
				<input
					type="text"
					value={searchInput}
					oninput={handleSearchInput}
					placeholder="Search media by title or path..."
					class="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<button
					type="submit"
					class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
				>
					🔍
				</button>
			</div>
		</form>

		<div class="flex gap-2">
			<select
				value={mediaType}
				onchange={handleMediaTypeChange}
				class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			>
				<option value="all">All Types</option>
				<option value="image">Images</option>
				<option value="video">Videos</option>
				<option value="animated">Animated</option>
			</select>

			<div class="flex border border-gray-300 rounded-lg overflow-hidden">
				<button
					type="button"
					onclick={() => onViewModeChange('grid')}
					class="px-4 py-2 {viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
				>
					⊞ Grid
				</button>
				<button
					type="button"
					onclick={() => onViewModeChange('list')}
					class="px-4 py-2 border-l border-gray-300 {viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
				>
					☰ List
				</button>
			</div>
		</div>
	</div>
</div>
