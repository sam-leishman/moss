<script lang="ts">
	import type { Tag } from '$lib/server/db';
	import { Tag as TagIcon, Plus, Minus, X } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		selectedCount: number;
		selectedMediaIds: number[];
		onAddTags: (tagIds: number[]) => Promise<void>;
		onRemoveTags: (tagIds: number[]) => Promise<void>;
		onClose: () => void;
	}

	let { selectedCount, selectedMediaIds, onAddTags, onRemoveTags, onClose }: Props = $props();

	interface TagWithState {
		id: number;
		name: string;
		appliedCount: number;
		totalCount: number;
		state: 'all' | 'some' | 'none';
	}

	let tagsWithState = $state<TagWithState[]>([]);
	let selectedTagIds = $state<number[]>([]);
	let loading = $state(false);
	let loadingTags = $state(false);
	let error = $state<string | null>(null);
	let operation = $state<'add' | 'remove'>('add');

	const loadTagsWithState = async () => {
		loadingTags = true;
		try {
			const response = await fetch('/api/media/tags-for-items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ media_ids: selectedMediaIds })
			});
			if (response.ok) {
				tagsWithState = await response.json();
			}
		} catch (err) {
			console.error('Failed to load tags:', err);
		} finally {
			loadingTags = false;
		}
	};

	onMount(() => {
		loadTagsWithState();
	});

	const toggleTag = (tagId: number) => {
		if (selectedTagIds.includes(tagId)) {
			selectedTagIds = selectedTagIds.filter(id => id !== tagId);
		} else {
			selectedTagIds = [...selectedTagIds, tagId];
		}
	};

	const handleApply = async () => {
		if (selectedTagIds.length === 0) return;

		loading = true;
		error = null;

		try {
			if (operation === 'add') {
				await onAddTags(selectedTagIds);
			} else {
				await onRemoveTags(selectedTagIds);
			}
			selectedTagIds = [];
			onClose();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Operation failed';
		} finally {
			loading = false;
		}
	};

	const selectedTagObjects = $derived(tagsWithState.filter(tag => selectedTagIds.includes(tag.id)));

	const getTagButtonClass = (tag: TagWithState, isSelected: boolean) => {
		if (isSelected) {
			return 'border-blue-600 bg-blue-50 text-blue-600';
		}
		if (tag.state === 'all') {
			return 'border-green-500 bg-green-50 text-green-700';
		}
		if (tag.state === 'some') {
			return 'border-green-300 bg-green-50/50 text-green-600/70';
		}
		return 'border-gray-300 text-gray-700 hover:bg-gray-50';
	};

	const getTagIcon = (tag: TagWithState) => {
		if (tag.state === 'all') return '✓';
		if (tag.state === 'some') return '◐';
		return '';
	};
</script>

<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center justify-between p-4 border-b border-gray-200">
			<h3 class="text-lg font-semibold text-gray-900">
				Bulk Tag {selectedCount} Item{selectedCount !== 1 ? 's' : ''}
			</h3>
			<button
				type="button"
				onclick={onClose}
				class="text-gray-400 hover:text-gray-600"
				aria-label="Close"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => operation = 'add'}
					class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors {operation === 'add' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}"
				>
					<Plus class="w-4 h-4" />
					Add Tags
				</button>
				<button
					type="button"
					onclick={() => operation = 'remove'}
					class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors {operation === 'remove' ? 'border-red-600 bg-red-50 text-red-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}"
				>
					<Minus class="w-4 h-4" />
					Remove Tags
				</button>
			</div>

			{#if error}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
					{error}
				</div>
			{/if}

			<div>
				<div class="flex items-center justify-between mb-3">
					<h4 class="text-sm font-medium text-gray-700">Select Tags</h4>
					<div class="flex items-center gap-3 text-xs text-gray-500">
						<div class="flex items-center gap-1">
							<span class="w-3 h-3 rounded border-2 border-green-500 bg-green-50"></span>
							<span>All</span>
						</div>
						<div class="flex items-center gap-1">
							<span class="w-3 h-3 rounded border-2 border-green-300 bg-green-50/50"></span>
							<span>Some</span>
						</div>
					</div>
				</div>
				{#if loadingTags}
					<p class="text-sm text-gray-500 text-center py-8">Loading tags...</p>
				{:else if tagsWithState.length === 0}
					<p class="text-sm text-gray-500 text-center py-8">No tags available. Create tags first.</p>
				{:else}
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
						{#each tagsWithState as tag (tag.id)}
							<button
								type="button"
								onclick={() => toggleTag(tag.id)}
								class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border-2 transition-colors {getTagButtonClass(tag, selectedTagIds.includes(tag.id))}"
								title="{tag.state === 'all' ? 'Applied to all items' : tag.state === 'some' ? `Applied to ${tag.appliedCount} of ${tag.totalCount} items` : 'Not applied'}"
							>
								{#if getTagIcon(tag)}
									<span class="text-xs font-bold">{getTagIcon(tag)}</span>
								{:else}
									<TagIcon class="w-3 h-3" />
								{/if}
								<span class="flex-1 text-left truncate">{tag.name}</span>
								{#if tag.state === 'some'}
									<span class="text-xs opacity-60">{tag.appliedCount}/{tag.totalCount}</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if selectedTagObjects.length > 0}
				<div>
					<h4 class="text-sm font-medium text-gray-700 mb-2">Selected Tags ({selectedTagObjects.length})</h4>
					<div class="flex flex-wrap gap-2">
						{#each selectedTagObjects as tag (tag.id)}
							<div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
								<TagIcon class="w-3 h-3" />
								<span>{tag.name}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
			<button
				type="button"
				onclick={onClose}
				class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleApply}
				disabled={loading || selectedTagIds.length === 0}
				class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed {operation === 'add' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}"
			>
				{loading ? 'Processing...' : operation === 'add' ? 'Add Tags' : 'Remove Tags'}
			</button>
		</div>
	</div>
</div>
