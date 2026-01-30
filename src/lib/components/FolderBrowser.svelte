<script lang="ts">
	import { onMount } from 'svelte';
	import { Folder } from 'lucide-svelte';

	interface FolderItem {
		name: string;
		path: string;
		displayPath: string;
		isDirectory: boolean;
	}

	interface Props {
		onSelect: (path: string) => void;
	}

	let { onSelect }: Props = $props();

	let currentPath = $state('');
	let displayPath = $state('/media');
	let parentPath = $state<string | null>(null);
	let folders = $state<FolderItem[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		loadFolders();
	});

	async function loadFolders(path?: string) {
		loading = true;
		error = null;
		try {
			const url = new URL('/api/folders', window.location.origin);
			if (path) {
				url.searchParams.set('path', path);
			}

			const response = await fetch(url);
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to load folders');
			}

			const data = await response.json();
			currentPath = data.currentPath;
			displayPath = data.displayPath || '/media';
			parentPath = data.parentPath;
			folders = data.folders;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load folders';
		} finally {
			loading = false;
		}
	}

	function navigateToFolder(path: string) {
		loadFolders(path);
	}

	function selectCurrentFolder() {
		// Pass the /media-prefixed path that works in Docker
		const dockerPath = `/media${displayPath === '/' ? '' : displayPath}`;
		onSelect(dockerPath);
	}
</script>

<div class="flex flex-col gap-3">
	<div class="pb-3 border-b border-gray-200">
		<div class="flex items-center gap-2 mb-2">
			<span class="text-xs font-medium text-gray-500 uppercase">Current Location:</span>
			<span class="text-sm font-semibold text-blue-600 font-mono">/media{displayPath === '/' ? '' : displayPath}</span>
		</div>
		<p class="text-xs text-gray-600">Navigate to a folder below, then click Select to choose it.</p>
	</div>

	{#if error}
		<div class="px-3 py-2 text-sm text-red-800 bg-red-100 rounded">{error}</div>
	{/if}

	{#if loading}
		<div class="py-8 text-sm text-center text-gray-500">Loading folders...</div>
	{:else}
		<div class="flex flex-col gap-1.5 overflow-y-auto max-h-80">
			{#if parentPath}
				<button 
					onclick={() => navigateToFolder(parentPath!)}
					class="flex items-center w-full gap-2 px-3 py-2 font-semibold text-left transition-colors bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-blue-500"
				>
					<Folder class="w-5 h-5 flex-shrink-0 text-gray-600" />
					<span class="flex-1 truncate text-gray-700">..</span>
				</button>
			{/if}

			{#if folders.length === 0}
				<div class="py-8 text-sm text-center text-gray-500">
					<p>No subfolders in this directory.</p>
				</div>
			{:else}
				{#each folders as folder (folder.path)}
					<button 
						onclick={() => navigateToFolder(folder.path)}
						class="flex items-center w-full gap-2 px-3 py-2 text-left transition-colors bg-white border border-gray-200 rounded hover:bg-gray-50 hover:border-blue-500"
					>
						<Folder class="w-5 h-5 flex-shrink-0 text-gray-600" />
						<span class="flex-1 truncate text-gray-700">{folder.name}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}

	<div class="pt-4 mt-4 border-t border-gray-200">
		<button 
			onclick={selectCurrentFolder}
			class="w-full px-4 py-2.5 text-sm font-medium text-white transition-colors bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
		>
			Select /media{displayPath === '/' ? '' : displayPath}
		</button>
	</div>
</div>

