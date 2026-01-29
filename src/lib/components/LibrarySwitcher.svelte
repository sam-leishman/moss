<script lang="ts">
	import { onMount } from 'svelte';
	import type { Library } from '$lib/server/db';

	interface Props {
		onLibraryChange?: (library: Library | null) => void;
	}

	let { onLibraryChange }: Props = $props();

	let libraries = $state<Library[]>([]);
	let selectedLibrary = $state<Library | null>(null);
	let showDropdown = $state(false);
	let showCreateModal = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let scanning = $state(false);
	let scanStats = $state<{ added: number; updated: number; removed: number } | null>(null);

	let newLibraryName = $state('');
	let newLibraryPath = $state('');

	onMount(() => {
		loadLibraries();
	});

	async function loadLibraries() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/libraries');
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to load libraries');
			}
			const data = await response.json();
			libraries = data.libraries;
			
			if (libraries.length > 0 && !selectedLibrary) {
				selectLibrary(libraries[0]);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load libraries';
		} finally {
			loading = false;
		}
	}

	function selectLibrary(library: Library) {
		selectedLibrary = library;
		showDropdown = false;
		onLibraryChange?.(library);
	}

	function openCreateModal() {
		newLibraryName = '';
		newLibraryPath = '';
		showDropdown = false;
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
		newLibraryName = '';
		newLibraryPath = '';
	}

	async function createLibrary() {
		if (!newLibraryName.trim() || !newLibraryPath.trim()) {
			error = 'Library name and folder path are required';
			return;
		}

		loading = true;
		error = null;
		try {
			const response = await fetch('/api/libraries', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newLibraryName.trim(),
					folder_path: newLibraryPath.trim()
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create library');
			}

			const data = await response.json();
			libraries = [data.library, ...libraries];
			selectLibrary(data.library);
			closeCreateModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create library';
		} finally {
			loading = false;
		}
	}

	async function scanLibrary() {
		if (!selectedLibrary || scanning) return;

		scanning = true;
		error = null;
		scanStats = null;
		showDropdown = false;

		try {
			const response = await fetch(`/api/libraries/${selectedLibrary.id}/scan`, {
				method: 'POST'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to scan library');
			}

			const data = await response.json();
			scanStats = {
				added: data.stats.added,
				updated: data.stats.updated,
				removed: data.stats.removed
			};

			if (data.errors && data.errors.length > 0) {
				error = `Scan completed with ${data.errors.length} error(s)`;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to scan library';
		} finally {
			scanning = false;
		}
	}

	async function cleanupLibrary() {
		if (!selectedLibrary || scanning) return;

		scanning = true;
		error = null;
		scanStats = null;
		showDropdown = false;

		try {
			const response = await fetch(`/api/libraries/${selectedLibrary.id}/cleanup`, {
				method: 'POST'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to cleanup library');
			}

			const data = await response.json();
			scanStats = {
				added: 0,
				updated: 0,
				removed: data.removedCount
			};
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to cleanup library';
		} finally {
			scanning = false;
		}
	}

	function closeDropdown(e: MouseEvent) {
		if (!(e.target as HTMLElement).closest('.library-switcher')) {
			showDropdown = false;
		}
	}

	$effect(() => {
		if (showDropdown) {
			document.addEventListener('click', closeDropdown);
			return () => document.removeEventListener('click', closeDropdown);
		}
	});
</script>

<div class="library-switcher relative">
	<button
		onclick={() => showDropdown = !showDropdown}
		class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-md hover:bg-gray-50"
	>
		<span>📚</span>
		<span>{selectedLibrary?.name || 'Select Library'}</span>
		<svg class="w-4 h-4 transition-transform" class:rotate-180={showDropdown} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if showDropdown}
		<div class="absolute right-0 z-50 w-64 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
			<div class="py-1">
				{#if libraries.length === 0}
					<div class="px-4 py-3 text-sm text-gray-500">No libraries yet</div>
				{:else}
					{#each libraries as library (library.id)}
						<button
							onclick={() => selectLibrary(library)}
							class="flex items-center w-full gap-2 px-4 py-2 text-sm text-left transition-colors hover:bg-gray-50"
							class:bg-blue-50={selectedLibrary?.id === library.id}
							class:text-blue-600={selectedLibrary?.id === library.id}
						>
							<span class="flex-1 truncate">{library.name}</span>
							{#if selectedLibrary?.id === library.id}
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
								</svg>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
			{#if selectedLibrary}
				<div class="border-t border-gray-200">
					<button
						onclick={scanLibrary}
						disabled={scanning}
						class="flex items-center w-full gap-2 px-4 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						<span>{scanning ? 'Scanning...' : 'Scan Library'}</span>
					</button>
					<button
						onclick={cleanupLibrary}
						disabled={scanning}
						class="flex items-center w-full gap-2 px-4 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						<span>Cleanup Orphaned</span>
					</button>
				</div>
			{/if}
			<div class="border-t border-gray-200">
				<button
					onclick={openCreateModal}
					class="flex items-center w-full gap-2 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-gray-50"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					<span>New Library</span>
				</button>
			</div>
		</div>
	{/if}

	{#if scanStats}
		<div class="fixed top-20 right-6 z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
			<div class="flex items-start justify-between mb-3">
				<h4 class="font-semibold text-gray-900">Scan Complete</h4>
				<button onclick={() => scanStats = null} class="text-gray-400 hover:text-gray-600">
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>
			<div class="space-y-2 text-sm">
				{#if scanStats.added > 0}
					<div class="flex justify-between">
						<span class="text-gray-600">Added:</span>
						<span class="font-medium text-green-600">{scanStats.added}</span>
					</div>
				{/if}
				{#if scanStats.updated > 0}
					<div class="flex justify-between">
						<span class="text-gray-600">Updated:</span>
						<span class="font-medium text-blue-600">{scanStats.updated}</span>
					</div>
				{/if}
				{#if scanStats.removed > 0}
					<div class="flex justify-between">
						<span class="text-gray-600">Removed:</span>
						<span class="font-medium text-red-600">{scanStats.removed}</span>
					</div>
				{/if}
				{#if scanStats.added === 0 && scanStats.updated === 0 && scanStats.removed === 0}
					<p class="text-gray-500">No changes detected</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={closeCreateModal}>
		<div class="w-full max-w-md bg-white rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-semibold">New Library</h3>
				<button onclick={closeCreateModal} class="flex items-center justify-center w-8 h-8 text-2xl text-gray-500 transition-colors hover:text-gray-900">
					×
				</button>
			</div>
			
			<div class="p-6">
				{#if error}
					<div class="px-3 py-2 mb-4 text-sm text-red-800 bg-red-100 border border-red-200 rounded">
						{error}
					</div>
				{/if}

				<div class="mb-4">
					<label for="library-name" class="block mb-2 text-sm font-medium text-gray-700">Library Name</label>
					<input
						id="library-name"
						type="text"
						bind:value={newLibraryName}
						placeholder="My Media Library"
						class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
					/>
				</div>

				<div class="mb-4">
					<label for="library-path" class="block mb-2 text-sm font-medium text-gray-700">Folder Path</label>
					<input
						id="library-path"
						type="text"
						bind:value={newLibraryPath}
						placeholder="/media/photos"
						class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
					/>
					<p class="mt-1 text-xs text-gray-500">Path must be within /media directory</p>
				</div>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
				<button onclick={closeCreateModal} class="px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-gray-200 rounded-md hover:bg-gray-300">
					Cancel
				</button>
				<button 
					onclick={createLibrary} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={loading || !newLibraryName.trim() || !newLibraryPath.trim()}
				>
					{loading ? 'Creating...' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.rotate-180 {
		transform: rotate(180deg);
	}
</style>
