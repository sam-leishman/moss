<script lang="ts">
	import type { Tag } from '$lib/server/db';
	import { Tag as TagIcon, X, Loader2 } from 'lucide-svelte';

	interface Props {
		mediaId: number;
		libraryId: number;
	}

	let { mediaId, libraryId }: Props = $props();

	let allTags = $state<Tag[]>([]);
	let assignedTags = $state<Tag[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let assigning = $state<number | null>(null);
	let removing = $state<number | null>(null);
	let showDropdown = $state(false);
	let previousLibraryId = $state<number | null>(null);
	let previousMediaId = $state<number | null>(null);

	const loadTags = async () => {
		loading = true;
		error = null;
		try {
			const [allResponse, assignedResponse] = await Promise.all([
				fetch(`/api/tags?library_id=${libraryId}`),
				fetch(`/api/media/${mediaId}/tags`)
			]);

			if (!allResponse.ok || !assignedResponse.ok) {
				throw new Error('Failed to load tags');
			}

			allTags = await allResponse.json();
			assignedTags = await assignedResponse.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load tags';
		} finally {
			loading = false;
		}
	};

	const assignTag = async (tagId: number) => {
		assigning = tagId;
		error = null;
		try {
			const response = await fetch(`/api/media/${mediaId}/tags`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tag_id: tagId })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to assign tag');
			}

			await loadTags();
			showDropdown = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to assign tag';
		} finally {
			assigning = null;
		}
	};

	const removeTag = async (tagId: number) => {
		removing = tagId;
		error = null;
		try {
			const response = await fetch(`/api/media/${mediaId}/tags?tag_id=${tagId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to remove tag');
			}

			await loadTags();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove tag';
		} finally {
			removing = null;
		}
	};

	const availableTags = $derived(
		allTags.filter(tag => !assignedTags.some(assigned => assigned.id === tag.id))
	);

	const handleClickOutside = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.tag-selector-dropdown')) {
			showDropdown = false;
		}
	};

	$effect(() => {
		// Reload when library or media changes
		if (libraryId !== previousLibraryId || mediaId !== previousMediaId) {
			previousLibraryId = libraryId;
			previousMediaId = mediaId;
			loadTags();
		}
	});

	$effect(() => {
		if (showDropdown) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tags</h4>
		{#if !loading && allTags.length > 0}
			<div class="relative tag-selector-dropdown">
				<button
					type="button"
					onclick={() => showDropdown = !showDropdown}
					class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
				>
					+ Add Tag
				</button>
				
				{#if showDropdown && availableTags.length > 0}
					<div class="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10 max-h-60 overflow-y-auto">
						{#each availableTags as tag (tag.id)}
							<button
								type="button"
								onclick={() => assignTag(tag.id)}
								disabled={assigning === tag.id}
								class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 transition-colors"
							>
								{#if assigning === tag.id}
									<span class="flex items-center gap-2">
										<Loader2 class="w-3 h-3 animate-spin" />
										{tag.name}
									</span>
								{:else}
									{tag.name}
								{/if}
							</button>
						{/each}
					</div>
				{:else if showDropdown && availableTags.length === 0}
					<div class="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10 p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
						All tags assigned
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if error}
		<div class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			<Loader2 class="w-4 h-4 animate-spin" />
			Loading tags...
		</div>
	{:else if assignedTags.length === 0}
		<p class="text-sm text-gray-500 dark:text-gray-400">No tags assigned</p>
	{:else}
		<div class="flex flex-wrap gap-2">
			{#each assignedTags as tag (tag.id)}
				<div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm">
					<TagIcon class="w-3 h-3" />
					<span>{tag.name}</span>
					<button
						type="button"
						onclick={() => removeTag(tag.id)}
						disabled={removing === tag.id}
						class="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 disabled:text-blue-400 dark:disabled:text-blue-600 transition-colors"
						aria-label="Remove tag"
					>
						{#if removing === tag.id}
							<Loader2 class="w-3 h-3 animate-spin" />
						{:else}
							<X class="w-3 h-3" />
						{/if}
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if !loading && allTags.length === 0}
		<p class="text-sm text-gray-500 dark:text-gray-400">No tags available. Create tags first in the tag management section.</p>
	{/if}
</div>
