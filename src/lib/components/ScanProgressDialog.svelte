<script lang="ts">
	import { X, RefreshCw, CheckCircle, AlertTriangle, Loader2 } from 'lucide-svelte';

	interface ScanProgress {
		libraryId: number;
		totalFiles: number;
		processedFiles: number;
		addedFiles: number;
		updatedFiles: number;
		errors: number;
		thumbnailsGenerated?: number;
		status: 'scanning' | 'processing' | 'completed' | 'failed';
	}

	interface ScanResult {
		success: boolean;
		stats?: {
			totalScanned: number;
			added: number;
			updated: number;
			removed: number;
			thumbnailsGenerated: number;
			errors: number;
			duration: number;
		};
		error?: string;
		pathMissing?: boolean;
		errors?: Array<{ path: string; error: string }>;
	}

	interface Props {
		libraryId: number;
		libraryName: string;
		onClose: () => void;
		onComplete?: (result: ScanResult) => void;
	}

	let { libraryId, libraryName, onClose, onComplete }: Props = $props();

	let progress = $state<ScanProgress | null>(null);
	let result = $state<ScanResult | null>(null);
	let error = $state<string | null>(null);
	let scanning = $state(true);

	const statusLabel = $derived.by(() => {
		if (error) return 'Error';
		if (result) return 'Complete';
		if (!progress) return 'Starting scan...';
		switch (progress.status) {
			case 'scanning': return 'Scanning files...';
			case 'processing': return 'Processing files...';
			case 'completed': return 'Complete';
			case 'failed': return 'Failed';
			default: return 'Working...';
		}
	});

	const progressPercent = $derived.by(() => {
		if (!progress || progress.totalFiles === 0) return 0;
		return Math.round((progress.processedFiles / progress.totalFiles) * 100);
	});

	function handleClose() {
		if (result) {
			onComplete?.(result);
		}
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !scanning) {
			handleClose();
		}
	}

	$effect(() => {
		const abortController = new AbortController();

		(async () => {
			try {
				const response = await fetch(`/api/libraries/${libraryId}/scan`, {
					method: 'POST',
					signal: abortController.signal
				});

				if (!response.ok || !response.body) {
					error = 'Failed to start scan';
					scanning = false;
					return;
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });

					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					let currentEvent = '';
					for (const line of lines) {
						if (line.startsWith('event: ')) {
							currentEvent = line.slice(7);
						} else if (line.startsWith('data: ')) {
							const data = JSON.parse(line.slice(6));

							if (currentEvent === 'progress') {
								progress = data;
							} else if (currentEvent === 'complete') {
								result = data;
								scanning = false;
							} else if (currentEvent === 'error') {
								if (data.pathMissing) {
									result = { success: false, error: data.error, pathMissing: true };
								} else {
									error = data.error || 'Scan failed';
								}
								scanning = false;
							}
						}
					}
				}

				if (scanning) {
					scanning = false;
				}
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') return;
				error = err instanceof Error ? err.message : 'Scan failed';
				scanning = false;
			}
		})();

		return () => {
			abortController.abort();
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={() => !scanning && handleClose()}
	role="dialog"
	aria-modal="true"
	aria-labelledby="scan-progress-title"
	tabindex="-1"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl"
		onclick={(e) => e.stopPropagation()}
		role="document"
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 id="scan-progress-title" class="text-lg font-semibold text-gray-900 dark:text-white">
				Scanning Library
			</h3>
			{#if !scanning}
				<button
					onclick={handleClose}
					class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
				>
					<X class="w-6 h-6" />
				</button>
			{/if}
		</div>

		<!-- Content -->
		<div class="px-6 py-5 space-y-4">
			<!-- Status -->
			<div class="flex items-center gap-3">
				{#if error || result?.pathMissing}
					<AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0" />
				{:else if result}
					<CheckCircle class="w-5 h-5 text-green-500 flex-shrink-0" />
				{:else if scanning}
					<Loader2 class="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
				{/if}
				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-gray-900 dark:text-white">{statusLabel}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{libraryName}</p>
				</div>
			</div>

			<!-- Progress bar -->
			{#if scanning && progress && progress.totalFiles > 0}
				<div>
					<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
						<span>{progress.processedFiles.toLocaleString()} / {progress.totalFiles.toLocaleString()} files</span>
						<span>{progressPercent}%</span>
					</div>
					<div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
						<div
							class="h-full bg-blue-500 rounded-full transition-all duration-300"
							style="width: {progressPercent}%"
						></div>
					</div>
				</div>
			{:else if scanning && !progress}
				<div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
					<div class="h-full w-1/3 bg-blue-500 rounded-full animate-pulse"></div>
				</div>
			{/if}

			<!-- Live stats during scan -->
			{#if scanning && progress && progress.status === 'processing'}
				<div class="grid grid-cols-3 gap-3 text-center">
					<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
						<p class="text-lg font-semibold text-green-600">{progress.addedFiles}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">Added</p>
					</div>
					<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
						<p class="text-lg font-semibold text-blue-600">{progress.updatedFiles}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">Updated</p>
					</div>
					{#if progress.thumbnailsGenerated !== undefined && progress.thumbnailsGenerated > 0}
						<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
							<p class="text-lg font-semibold text-purple-600">{progress.thumbnailsGenerated}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Thumbnails</p>
						</div>
					{:else}
						<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
							<p class="text-lg font-semibold text-red-600">{progress.errors}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Errors</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Error message -->
			{#if error || result?.pathMissing}
				<div class="px-3 py-2 text-sm text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
					{error || result?.error}
				</div>
			{/if}

			<!-- Final results -->
			{#if result?.success && result.stats}
				<div class="space-y-2">
					<div class="grid grid-cols-2 gap-3">
						<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
							<p class="text-xl font-bold text-gray-900 dark:text-white">{result.stats.totalScanned.toLocaleString()}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Total Files</p>
						</div>
						<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
							<p class="text-xl font-bold text-gray-900 dark:text-white">{(result.stats.duration / 1000).toFixed(1)}s</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Duration</p>
						</div>
					</div>
					<div class="grid grid-cols-4 gap-2 text-center">
						<div>
							<p class="text-sm font-semibold text-green-600">{result.stats.added}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Added</p>
						</div>
						<div>
							<p class="text-sm font-semibold text-blue-600">{result.stats.updated}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Updated</p>
						</div>
						<div>
							<p class="text-sm font-semibold text-red-600">{result.stats.removed}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Removed</p>
						</div>
						<div>
							<p class="text-sm font-semibold text-purple-600">{result.stats.thumbnailsGenerated}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Thumbnails</p>
						</div>
					</div>
					{#if result.stats.errors > 0}
						<p class="text-xs text-amber-600 dark:text-amber-400">
							{result.stats.errors} error{result.stats.errors !== 1 ? 's' : ''} during scan
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		{#if !scanning}
			<div class="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button
					onclick={handleClose}
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700"
				>
					Done
				</button>
			</div>
		{/if}
	</div>
</div>
