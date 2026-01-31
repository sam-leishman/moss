<script lang="ts">
	import type { Tag } from '$lib/server/db';
	import { Tag as TagIcon, Trash2, Loader2 } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		onTagsChange?: () => void;
	}

	let { onTagsChange }: Props = $props();

	let tags = $state<Tag[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let newTagName = $state('');
	let creating = $state(false);
	let deletingId = $state<number | null>(null);

	const loadTags = async () => {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/tags');
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to load tags');
			}
			tags = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load tags';
		} finally {
			loading = false;
		}
	};

	const createTag = async () => {
		if (!newTagName.trim()) return;

		creating = true;
		error = null;
		try {
			const response = await fetch('/api/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newTagName.trim() })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create tag');
			}

			newTagName = '';
			await loadTags();
			onTagsChange?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create tag';
		} finally {
			creating = false;
		}
	};

	const deleteTag = async (tagId: number) => {
		if (!confirm('Are you sure you want to delete this tag? It will be removed from all media items.')) {
			return;
		}

		deletingId = tagId;
		error = null;
		try {
			const response = await fetch(`/api/tags/${tagId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to delete tag');
			}

			await loadTags();
			onTagsChange?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete tag';
		} finally {
			deletingId = null;
		}
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			createTag();
		}
	};

	onMount(() => {
		loadTags();
	});
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
	<h3 class="text-lg font-semibold text-gray-900 mb-4">Tag Management</h3>

	{#if error}
		<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
			{error}
		</div>
	{/if}

	<div class="mb-6">
		<label for="new-tag" class="block text-sm font-medium text-gray-700 mb-2">
			Create New Tag
		</label>
		<div class="flex gap-2">
			<input
				id="new-tag"
				type="text"
				bind:value={newTagName}
				onkeydown={handleKeydown}
				placeholder="Enter tag name (alphanumeric, -, _, spaces)"
				class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				disabled={creating}
				maxlength="50"
			/>
			<button
				type="button"
				onclick={createTag}
				disabled={creating || !newTagName.trim()}
				class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
			>
				{creating ? 'Creating...' : 'Create'}
			</button>
		</div>
		<p class="mt-1 text-xs text-gray-500">
			Max 50 characters. Only letters, numbers, hyphens, underscores, and spaces allowed.
		</p>
	</div>

	<div>
		<h4 class="text-sm font-medium text-gray-700 mb-3">Existing Tags ({tags.length})</h4>
		
		{#if loading}
			<div class="text-center py-8 text-gray-500">
				<Loader2 class="inline-block animate-spin h-8 w-8" />
				<p class="mt-2">Loading tags...</p>
			</div>
		{:else if tags.length === 0}
			<div class="text-center py-8 text-gray-500">
				<TagIcon class="mx-auto h-12 w-12 text-gray-400" />
				<p class="mt-2">No tags yet</p>
				<p class="text-sm">Create your first tag above</p>
			</div>
		{:else}
			<div class="space-y-2 max-h-96 overflow-y-auto">
				{#each tags as tag (tag.id)}
					<div class="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
						<div class="flex items-center gap-2">
							<TagIcon class="w-4 h-4 text-gray-400" />
							<span class="text-sm font-medium text-gray-900">{tag.name}</span>
						</div>
						<button
							type="button"
							onclick={() => deleteTag(tag.id)}
							disabled={deletingId === tag.id}
							class="text-red-600 hover:text-red-800 disabled:text-gray-400 transition-colors"
							aria-label="Delete tag"
						>
							{#if deletingId === tag.id}
								<Loader2 class="w-5 h-5 animate-spin" />
							{:else}
								<Trash2 class="w-5 h-5" />
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
