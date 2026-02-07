<script lang="ts">
	import { X, Loader2 } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
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
	let showLoadingState = $state(false);
	let error = $state<string | null>(null);
	let isProcessing = $state(false);
	let showProgress = $state(false);
	let progress = $state({ current: 0, total: 0, percentage: 0 });
	let processingStartTime = $state<number | null>(null);
	let abortController = $state<AbortController | null>(null);
	let progressDelayTimeout: ReturnType<typeof setTimeout> | null = null;
	let loadingDelayTimeout: ReturnType<typeof setTimeout> | null = null;

	const loadPropertyState = async () => {
		loadingState = true;
		showLoadingState = false;
		error = null;
		
		// Only show loading UI if it takes longer than 500ms
		loadingDelayTimeout = setTimeout(() => {
			showLoadingState = true;
		}, 500);
		
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
			if (loadingDelayTimeout) {
				clearTimeout(loadingDelayTimeout);
				loadingDelayTimeout = null;
			}
			loadingState = false;
			showLoadingState = false;
		}
	};

	const handleBulkEdit = async (property: 'tags' | 'credits', operation: 'add' | 'remove', value: number[]) => {
		error = null;
		isProcessing = true;
		showProgress = false;
		processingStartTime = Date.now();
		abortController = new AbortController();
		
		// Only show progress UI if operation takes longer than 500ms
		progressDelayTimeout = setTimeout(() => {
			showProgress = true;
		}, 500);
		
		const CHUNK_SIZE = 50;
		const totalItems = selectedMediaIds.length;
		progress = { current: 0, total: totalItems, percentage: 0 };
		
		try {
			// Process in chunks for better progress tracking
			for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
				if (abortController.signal.aborted) {
					throw new Error('Operation cancelled');
				}
				
				const chunk = selectedMediaIds.slice(i, Math.min(i + CHUNK_SIZE, totalItems));
				
				const response = await fetch('/api/media/bulk-edit', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						media_ids: chunk,
						property,
						operation,
						value
					}),
					signal: abortController.signal
				});

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.message || 'Operation failed');
				}
				
				progress = {
					current: Math.min(i + CHUNK_SIZE, totalItems),
					total: totalItems,
					percentage: Math.round((Math.min(i + CHUNK_SIZE, totalItems) / totalItems) * 100)
				};
			}

			await loadPropertyState();
			onComplete();
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				error = 'Operation cancelled';
			} else {
				error = err instanceof Error ? err.message : 'Operation failed';
			}
		} finally {
			if (progressDelayTimeout) {
				clearTimeout(progressDelayTimeout);
				progressDelayTimeout = null;
			}
			isProcessing = false;
			showProgress = false;
			processingStartTime = null;
			abortController = null;
		}
	};

	const cancelOperation = () => {
		if (abortController) {
			abortController.abort();
		}
		// Clear progress delay timeout to prevent UI from showing after cancellation
		if (progressDelayTimeout) {
			clearTimeout(progressDelayTimeout);
			progressDelayTimeout = null;
		}
	};

	const elapsedTime = $derived.by(() => {
		if (!processingStartTime) return 0;
		return Math.floor((Date.now() - processingStartTime) / 1000);
	});

	const estimatedTimeRemaining = $derived.by(() => {
		if (!isProcessing || progress.current === 0 || elapsedTime === 0) return null;
		const elapsed = elapsedTime;
		const rate = progress.current / elapsed;
		const remaining = progress.total - progress.current;
		return Math.ceil(remaining / rate);
	});

	const formatTime = (seconds: number) => {
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}m ${secs}s`;
	};

	onMount(() => {
		loadPropertyState();
	});

	onDestroy(() => {
		if (progressDelayTimeout) {
			clearTimeout(progressDelayTimeout);
		}
		if (loadingDelayTimeout) {
			clearTimeout(loadingDelayTimeout);
		}
		if (abortController) {
			abortController.abort();
		}
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
		class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
				{selectedCount === 1 ? 'Edit 1 Item' : `Bulk Edit ${selectedCount} Items`}
			</h3>
			<button
				type="button"
				onclick={onClose}
				class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
				aria-label="Close"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="border-b border-gray-200 dark:border-gray-700">
			<div class="flex">
				{#each tabs as tab (tab.id)}
					<button
						type="button"
						onclick={() => activeTab = tab.id}
						class="flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === tab.id ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if isProcessing && showProgress}
				<div class="p-4 space-y-4">
					<div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2">
								<Loader2 class="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
								<span class="text-sm font-medium text-blue-800 dark:text-blue-200">Processing...</span>
							</div>
							<button
								type="button"
								onclick={cancelOperation}
								class="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
							>
								Cancel
							</button>
						</div>
						
						<div class="space-y-2">
							<div class="flex items-center justify-between text-sm text-blue-700 dark:text-blue-300">
								<span>{progress.current} / {progress.total} items</span>
								<span class="font-medium">{progress.percentage}%</span>
							</div>
							<div class="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 overflow-hidden">
								<div 
									class="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300 ease-out"
									style="width: {progress.percentage}%"
								></div>
							</div>
							<div class="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
								<span>Elapsed: {formatTime(elapsedTime)}</span>
								{#if estimatedTimeRemaining !== null}
									<span>Est. remaining: {formatTime(estimatedTimeRemaining)}</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{:else if error}
				<div class="p-4">
					<div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
						{error}
					</div>
				</div>
			{:else if loadingState && showLoadingState}
				<div class="p-8 text-center text-gray-500 dark:text-gray-400">
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
