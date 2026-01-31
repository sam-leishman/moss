<script lang="ts">
	import { Tag as TagIcon } from 'lucide-svelte';

	interface TagWithState {
		id: number;
		name: string;
		appliedCount: number;
		totalCount: number;
		state: 'all' | 'some' | 'none';
	}

	interface Props {
		tags: TagWithState[];
		onApply: (operation: 'add' | 'remove', tagIds: number[]) => Promise<void>;
	}

	let { tags, onApply }: Props = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);

	const handleTagClick = async (tag: TagWithState) => {
		loading = true;
		error = null;

		try {
			if (tag.state === 'all') {
				await onApply('remove', [tag.id]);
			} else {
				await onApply('add', [tag.id]);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Operation failed';
		} finally {
			loading = false;
		}
	};

	const getTagButtonClass = (tag: TagWithState) => {
		if (tag.state === 'all') {
			return 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100';
		}
		if (tag.state === 'some') {
			return 'border-green-300 bg-green-50/50 text-green-600/70 hover:bg-green-100/70';
		}
		return 'border-gray-300 text-gray-700 hover:bg-gray-50';
	};

	const getTagIcon = (tag: TagWithState) => {
		if (tag.state === 'all') return '✓';
		if (tag.state === 'some') return '◐';
		return '';
	};

	const getTagTitle = (tag: TagWithState) => {
		if (tag.state === 'all') {
			return `Applied to all items - Click to remove`;
		}
		if (tag.state === 'some') {
			return `Applied to ${tag.appliedCount} of ${tag.totalCount} items - Click to add to all`;
		}
		return 'Not applied - Click to add';
	};
</script>

<div class="p-4 space-y-4">
	<div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
		<p class="text-sm text-blue-800">
			Click tags to add them to all selected items. Click again to remove from all items.
		</p>
	</div>

	{#if error}
		<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
			{error}
		</div>
	{/if}

	<div>
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-sm font-medium text-gray-700">Tags</h4>
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
		{#if tags.length === 0}
			<p class="text-sm text-gray-500 text-center py-8">No tags available. Create tags first.</p>
		{:else}
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
				{#each tags as tag (tag.id)}
					<button
						type="button"
						onclick={() => handleTagClick(tag)}
						disabled={loading}
						class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed {getTagButtonClass(tag)}"
						title={getTagTitle(tag)}
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
</div>
