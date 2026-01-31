<script lang="ts">
	import { X } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import BulkTagEditor from './bulk-editors/BulkTagEditor.svelte';
	import BulkCreditEditor from './bulk-editors/BulkCreditEditor.svelte';

	interface Props {
		selectedCount: number;
		selectedMediaIds: number[];
		onComplete: () => void;
		onClose: () => void;
	}

	let { selectedCount, selectedMediaIds, onComplete, onClose }: Props = $props();

	type TabType = 'tags' | 'credits';
	
	interface PropertyState {
		tags: Array<{
			id: number;
			name: string;
			appliedCount: number;
			totalCount: number;
			state: 'all' | 'some' | 'none';
		}>;
		credits: Array<{
			id: number;
			name: string;
			role: string;
			appliedCount: number;
			totalCount: number;
			state: 'all' | 'some' | 'none';
		}>;
	}

	let activeTab = $state<TabType>('tags');
	let propertyState = $state<PropertyState>({ tags: [], credits: [] });
	let loadingState = $state(false);
	let error = $state<string | null>(null);

	const loadPropertyState = async () => {
		loadingState = true;
		error = null;
		try {
			const response = await fetch('/api/media/properties-for-items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ media_ids: selectedMediaIds })
			});
			if (response.ok) {
				propertyState = await response.json();
			} else {
				throw new Error('Failed to load property state');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load properties';
		} finally {
			loadingState = false;
		}
	};

	const handleBulkEdit = async (property: 'tags' | 'credits', operation: 'add' | 'remove', value: number[]) => {
		error = null;
		try {
			const response = await fetch('/api/media/bulk-edit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					media_ids: selectedMediaIds,
					property,
					operation,
					value
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Operation failed');
			}

			await loadPropertyState();
			onComplete();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Operation failed';
			throw err;
		}
	};

	onMount(() => {
		loadPropertyState();
	});

	const tabs: Array<{ id: TabType; label: string }> = [
		{ id: 'tags', label: 'Tags' },
		{ id: 'credits', label: 'Credits' }
	];
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
				Bulk Edit {selectedCount} Item{selectedCount !== 1 ? 's' : ''}
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

		<div class="border-b border-gray-200">
			<div class="flex">
				{#each tabs as tab (tab.id)}
					<button
						type="button"
						onclick={() => activeTab = tab.id}
						class="flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if error}
				<div class="p-4">
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
						{error}
					</div>
				</div>
			{/if}

			{#if loadingState}
				<div class="p-8 text-center text-gray-500">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
					<p class="text-sm">Loading...</p>
				</div>
			{:else}
				{#if activeTab === 'tags'}
					<BulkTagEditor
						tags={propertyState.tags}
						onApply={(operation, tagIds) => handleBulkEdit('tags', operation, tagIds)}
					/>
				{:else if activeTab === 'credits'}
					<BulkCreditEditor
						people={propertyState.credits}
						onApply={(operation, personIds) => handleBulkEdit('credits', operation, personIds)}
					/>
				{/if}
			{/if}
		</div>
	</div>
</div>
