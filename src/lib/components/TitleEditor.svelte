<script lang="ts">
	import { FileText, X, Loader2 } from 'lucide-svelte';
	import { basename } from '$lib/utils/path';

	interface Props {
		mediaId: number;
		currentTitle: string | null;
		filePath: string;
		onUpdate?: () => void;
	}

	let { mediaId, currentTitle, filePath, onUpdate }: Props = $props();

	let title = $state(currentTitle ?? '');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let savedTitle = $state(currentTitle ?? '');
	let hasChanges = $derived(title !== savedTitle);
	let abortController: AbortController | null = null;
	
	$effect(() => {
		const newTitle = currentTitle ?? '';
		if (savedTitle !== newTitle) {
			title = newTitle;
			savedTitle = newTitle;
		}
		
		return () => {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
		};
	});

	const updateTitle = async (newTitle: string | null) => {
		if (abortController) {
			abortController.abort();
		}
		
		abortController = new AbortController();
		loading = true;
		error = null;
		
		try {
			const response = await fetch(`/api/media/${mediaId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: newTitle }),
				signal: abortController.signal
			});

			if (!response.ok) {
				let errorMessage = 'Failed to update title';
				try {
					const data = await response.json();
					errorMessage = data.message || errorMessage;
				} catch {
					// Response wasn't JSON, use default message
				}
				throw new Error(errorMessage);
			}

			title = newTitle ?? '';
			savedTitle = newTitle ?? '';
			onUpdate?.();
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			error = err instanceof Error ? err.message : 'Failed to update title';
		} finally {
			loading = false;
			abortController = null;
		}
	};

	const handleSave = async () => {
		const trimmedTitle = title.trim();
		await updateTitle(trimmedTitle || null);
	};

	const handleSetFromFilename = async () => {
		const filename = basename(filePath);
		const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
		title = nameWithoutExt;
		await updateTitle(nameWithoutExt);
	};

	const handleClear = async () => {
		title = '';
		await updateTitle(null);
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && hasChanges) {
			e.preventDefault();
			handleSave();
		}
	};
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Title</h4>
	</div>

	{#if error}
		<div class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200">
			{error}
		</div>
	{/if}

	<div class="space-y-2">
		<div class="relative">
			<input
				type="text"
				bind:value={title}
				onkeydown={handleKeydown}
				disabled={loading}
				placeholder="Enter title or leave empty to use filename"
				class="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
			/>
			{#if title && !loading}
				<button
					type="button"
					onclick={() => title = ''}
					class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
					aria-label="Clear input"
				>
					<X class="w-4 h-4" />
				</button>
			{/if}
			{#if loading}
				<div class="absolute right-2 top-1/2 -translate-y-1/2">
					<Loader2 class="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
				</div>
			{/if}
		</div>

		<div class="flex gap-2">
			<button
				type="button"
				onclick={handleSetFromFilename}
				disabled={loading}
				class="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<FileText class="w-3 h-3" />
				Set from filename
			</button>
			<button
				type="button"
				onclick={handleClear}
				disabled={loading || (!savedTitle && !title)}
				class="flex items-center justify-center gap-2 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<X class="w-3 h-3" />
				Clear
			</button>
		</div>

		{#if hasChanges}
			<button
				type="button"
				onclick={handleSave}
				disabled={loading}
				class="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Save Title
			</button>
		{/if}
	</div>
</div>
