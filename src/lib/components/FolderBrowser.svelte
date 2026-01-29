<script lang="ts">
	import { onMount } from 'svelte';

	interface FolderItem {
		name: string;
		path: string;
		isDirectory: boolean;
	}

	interface Props {
		onSelect: (path: string) => void;
	}

	let { onSelect }: Props = $props();

	let currentPath = $state('');
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
		onSelect(currentPath);
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center justify-between pb-3 border-b border-gray-200">
		<div class="flex flex-col flex-1 min-w-0 gap-1">
			<span class="text-xs font-medium text-gray-500 uppercase">Current:</span>
			<span class="text-sm text-gray-900 truncate font-mono">{currentPath || '/'}</span>
		</div>
		<button onclick={selectCurrentFolder} class="px-3 py-1.5 text-xs font-medium text-white transition-colors bg-blue-500 rounded-md hover:bg-blue-600">
			Select This Folder
		</button>
	</div>

	{#if error}
		<div class="px-3 py-2 text-sm text-red-800 bg-red-100 rounded">{error}</div>
	{/if}

	{#if loading}
		<div class="py-4 text-sm text-center text-gray-500">Loading folders...</div>
	{:else}
		<div class="flex flex-col gap-1 overflow-y-auto max-h-60">
			{#if parentPath}
				<button 
					onclick={() => navigateToFolder(parentPath!)}
					class="flex items-center w-full gap-2 px-3 py-2 font-semibold text-left transition-colors bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-blue-500"
				>
					<span class="text-xl flex-shrink-0">📁</span>
					<span class="flex-1 truncate text-gray-700">..</span>
				</button>
			{/if}

			{#if folders.length === 0}
				<div class="py-4 text-sm text-center text-gray-500">No subfolders in this directory</div>
			{:else}
				{#each folders as folder (folder.path)}
					<button 
						onclick={() => navigateToFolder(folder.path)}
						class="flex items-center w-full gap-2 px-3 py-2 text-left transition-colors bg-white border border-gray-200 rounded hover:bg-gray-50 hover:border-blue-500"
					>
						<span class="text-xl flex-shrink-0">📁</span>
						<span class="flex-1 truncate text-gray-700">{folder.name}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

