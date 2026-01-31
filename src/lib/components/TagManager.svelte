<script lang="ts">
	import type { Tag } from '$lib/server/db';
	import { Tag as TagIcon, Trash2, Loader2, Pencil, Globe } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		onTagsChange?: () => void;
		libraryId?: number;
	}

	let { onTagsChange, libraryId }: Props = $props();

	let tags = $state<Tag[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let newTagName = $state('');
	let isGlobal = $state(false);
	let creating = $state(false);
	let deletingId = $state<number | null>(null);
	let editingTag = $state<Tag | null>(null);
	let editTagName = $state('');
	let editIsGlobal = $state(false);
	let updating = $state(false);
	let showCrossLibraryWarning = $state(false);
	let crossLibraryUsage = $state<Array<{ library_id: number; library_name: string; count: number }>>([]);
	let totalAffectedItems = $state(0);

	const loadTags = async () => {
		loading = true;
		error = null;
		try {
			const url = libraryId ? `/api/tags?library_id=${libraryId}` : '/api/tags';
			const response = await fetch(url);
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

		if (!isGlobal && !libraryId) {
			error = 'Library ID is required for library-specific tags';
			return;
		}

		creating = true;
		error = null;
		try {
			const response = await fetch('/api/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					name: newTagName.trim(),
					library_id: libraryId,
					is_global: isGlobal
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create tag');
			}

			newTagName = '';
			isGlobal = false;
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

	const startEdit = (tag: Tag) => {
		editingTag = tag;
		editTagName = tag.name;
		editIsGlobal = tag.is_global === 1;
	};

	const cancelEdit = () => {
		editingTag = null;
		editTagName = '';
		editIsGlobal = false;
	};

	const updateTag = async (force = false) => {
		if (!editingTag || !editTagName.trim()) return;

		if (!editIsGlobal && !libraryId) {
			error = 'Library ID is required for library-specific tags';
			return;
		}

		updating = true;
		error = null;
		try {
			const response = await fetch(`/api/tags/${editingTag.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editTagName.trim(),
					library_id: libraryId,
					is_global: editIsGlobal,
					force
				})
			});

			if (response.status === 409) {
				const data = await response.json();
				if (data.error === 'cross_library_usage') {
					crossLibraryUsage = data.usage;
					totalAffectedItems = data.totalItems;
					showCrossLibraryWarning = true;
					updating = false;
					return;
				}
			}

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to update tag');
			}

			showCrossLibraryWarning = false;
			cancelEdit();
			await loadTags();
			onTagsChange?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update tag';
		} finally {
			updating = false;
		}
	};

	const confirmForceUpdate = async () => {
		showCrossLibraryWarning = false;
		await updateTag(true);
	};

	const cancelForceUpdate = () => {
		showCrossLibraryWarning = false;
		editIsGlobal = true;
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

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
	<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tag Management</h3>

	{#if error}
		<div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-200">
			{error}
		</div>
	{/if}

	<div class="mb-6">
		<label for="new-tag" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
			Create New Tag
		</label>
		<div class="space-y-3">
			<div class="flex gap-2">
				<input
					id="new-tag"
					type="text"
					bind:value={newTagName}
					onkeydown={handleKeydown}
					placeholder="Enter tag name (alphanumeric, -, _, spaces)"
					class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					disabled={creating}
					maxlength="50"
				/>
				<button
					type="button"
					onclick={createTag}
					disabled={creating || !newTagName.trim()}
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
				>
					{creating ? 'Creating...' : 'Create'}
				</button>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => isGlobal = !isGlobal}
					disabled={creating}
					aria-label="Toggle global tag"
					class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed {isGlobal ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}"
				>
					<span class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform {isGlobal ? 'translate-x-5' : 'translate-x-1'}"></span>
				</button>
				<span class="text-sm text-gray-700 dark:text-gray-300">
					Global
				</span>
			</div>
			<p class="text-xs text-gray-500 dark:text-gray-400">
				Max 50 characters. Only letters, numbers, hyphens, underscores, and spaces allowed.
			</p>
		</div>
	</div>

	<div>
		<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Existing Tags ({tags.length})</h4>
		
		{#if loading}
			<div class="text-center py-8 text-gray-500 dark:text-gray-400">
				<Loader2 class="inline-block animate-spin h-8 w-8" />
				<p class="mt-2">Loading tags...</p>
			</div>
		{:else if tags.length === 0}
			<div class="text-center py-8 text-gray-500 dark:text-gray-400">
				<TagIcon class="mx-auto h-12 w-12 text-gray-400" />
				<p class="mt-2">No tags yet</p>
				<p class="text-sm">Create your first tag above</p>
			</div>
		{:else}
			{@const globalTags = tags.filter(t => t.is_global === 1)}
			{@const libraryTags = tags.filter(t => t.is_global === 0)}
			
			<div class="space-y-4 max-h-96 overflow-y-auto">
				{#if globalTags.length > 0}
					<div>
						<h5 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Global Tags ({globalTags.length})</h5>
						<div class="space-y-2">
							{#each globalTags as tag (tag.id)}
								<div class="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
									<div class="flex items-center gap-2">
										<TagIcon class="w-4 h-4 text-blue-500 dark:text-blue-400" />
										<span class="text-sm font-medium text-gray-900 dark:text-white">{tag.name}</span>
										<Globe class="w-3 h-3 text-blue-500 dark:text-blue-400" />
									</div>
									<div class="flex gap-2">
										<button
											type="button"
											onclick={() => startEdit(tag)}
											class="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
											aria-label="Edit tag"
										>
											<Pencil class="w-4 h-4" />
										</button>
										<button
											type="button"
											onclick={() => deleteTag(tag.id)}
											disabled={deletingId === tag.id}
											class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:text-gray-400 dark:disabled:text-gray-600 transition-colors"
											aria-label="Delete tag"
										>
											{#if deletingId === tag.id}
												<Loader2 class="w-5 h-5 animate-spin" />
											{:else}
												<Trash2 class="w-5 h-5" />
											{/if}
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				
				{#if libraryTags.length > 0}
					<div>
						<h5 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Library-Specific Tags ({libraryTags.length})</h5>
						<div class="space-y-2">
							{#each libraryTags as tag (tag.id)}
								<div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
									<div class="flex items-center gap-2">
										<TagIcon class="w-4 h-4 text-gray-400 dark:text-gray-500" />
										<span class="text-sm font-medium text-gray-900 dark:text-white">{tag.name}</span>
									</div>
									<div class="flex gap-2">
										<button
											type="button"
											onclick={() => startEdit(tag)}
											class="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
											aria-label="Edit tag"
										>
											<Pencil class="w-4 h-4" />
										</button>
										<button
											type="button"
											onclick={() => deleteTag(tag.id)}
											disabled={deletingId === tag.id}
											class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:text-gray-400 dark:disabled:text-gray-600 transition-colors"
											aria-label="Delete tag"
										>
											{#if deletingId === tag.id}
												<Loader2 class="w-5 h-5 animate-spin" />
											{:else}
												<Trash2 class="w-5 h-5" />
											{/if}
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if editingTag}
	<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
			<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Tag</h3>
			
			<div class="space-y-4">
				<div>
					<label for="edit-tag-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Tag Name
					</label>
					<input
						id="edit-tag-name"
						type="text"
						bind:value={editTagName}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						placeholder="Enter tag name"
						maxlength="50"
					/>
				</div>
				
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => editIsGlobal = !editIsGlobal}
						aria-label="Toggle global tag"
						class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {editIsGlobal ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}"
					>
						<span class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform {editIsGlobal ? 'translate-x-5' : 'translate-x-1'}"></span>
					</button>
					<span class="text-sm text-gray-700 dark:text-gray-300">
						Global
					</span>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					type="button"
					onclick={cancelEdit}
					class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={() => updateTag()}
					disabled={updating || !editTagName.trim()}
					class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
				>
					{updating ? 'Updating...' : 'Update'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showCrossLibraryWarning}
	<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
			<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Tag Used in Other Libraries</h3>
			
			<div class="space-y-4">
				<p class="text-sm text-gray-700 dark:text-gray-300">
					This tag is currently applied to <strong>{totalAffectedItems}</strong> item{totalAffectedItems !== 1 ? 's' : ''} in the following {crossLibraryUsage.length === 1 ? 'library' : 'libraries'}:
				</p>
				
				<ul class="space-y-2">
					{#each crossLibraryUsage as lib}
						<li class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
							<span class="w-2 h-2 bg-blue-500 rounded-full"></span>
							<strong>{lib.library_name}</strong> ({lib.count} item{lib.count !== 1 ? 's' : ''})
						</li>
					{/each}
				</ul>
				
				<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
					<p class="text-sm text-amber-800 dark:text-amber-200">
						Converting this tag to library-specific will remove it from all items in other libraries. This action cannot be undone.
					</p>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					type="button"
					onclick={cancelForceUpdate}
					class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={confirmForceUpdate}
					class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
				>
					Remove & Convert
				</button>
			</div>
		</div>
	</div>
{/if}
