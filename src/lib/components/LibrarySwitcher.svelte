<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import FolderBrowser from './FolderBrowser.svelte';
	import type { Library } from '$lib/server/db';
	import { Library as LibraryIcon } from 'lucide-svelte';

	interface Props {
		currentLibrary?: Library;
	}

	let { currentLibrary }: Props = $props();

	let libraries = $state<Library[]>([]);
	let showDropdown = $state(false);
	let showCreateModal = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let scanning = $state(false);
	let scanStats = $state<{ added: number; updated: number; removed: number } | null>(null);
	let successMessage = $state<string | null>(null);

	let newLibraryName = $state('');
	let newLibraryPath = $state('');
	let showFolderBrowserModal = $state(false);

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
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load libraries';
		} finally {
			loading = false;
		}
	}

	function selectLibrary(library: Library) {
		showDropdown = false;
		goto(`/libraries/${library.id}`);
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
		showFolderBrowserModal = false;
		error = null;
	}

	function handleFolderSelect(path: string) {
		newLibraryPath = path;
		showFolderBrowserModal = false;
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
			closeCreateModal();
			goto(`/libraries/${data.library.id}`);
			
			// Show scan results
			if (data.scanStats) {
				const { added, updated, errors } = data.scanStats;
				if (errors > 0) {
					successMessage = `Library created and scanned: ${added} files added, ${updated} updated (${errors} errors)`;
				} else if (added > 0 || updated > 0) {
					successMessage = `Library created and scanned: ${added} files added${updated > 0 ? `, ${updated} updated` : ''}`;
				} else {
					successMessage = 'Library created successfully (no media files found)';
				}
				// Auto-dismiss success message after 5 seconds
				setTimeout(() => successMessage = null, 5000);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create library';
		} finally {
			loading = false;
		}
	}

	async function scanLibrary() {
		if (!currentLibrary || scanning) return;

		scanning = true;
		error = null;
		scanStats = null;
		showDropdown = false;

		try {
			const response = await fetch(`/api/libraries/${currentLibrary.id}/scan`, {
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
		<LibraryIcon class="w-5 h-5" />
		<span>{currentLibrary?.name || 'Select Library'}</span>
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
							class:bg-blue-50={currentLibrary?.id === library.id}
							class:text-blue-600={currentLibrary?.id === library.id}
						>
							<span class="flex-1 truncate">{library.name}</span>
							{#if currentLibrary?.id === library.id}
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
								</svg>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
			{#if currentLibrary}
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
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={closeCreateModal}
		onkeydown={(e) => e.key === 'Escape' && closeCreateModal()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-library-title-switcher"
		tabindex="-1"
	>
		<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				<h3 id="create-library-title-switcher" class="text-lg font-semibold">Create New Library</h3>
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
					<label for="library-name-switcher" class="block mb-2 text-sm font-medium text-gray-700">Library Name</label>
					<input
						id="library-name-switcher"
						type="text"
						bind:value={newLibraryName}
						placeholder="My Media Library"
						class="block w-full rounded-md text-sm focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<div class="mb-4">
					<label for="library-path-switcher" class="block mb-2 text-sm font-medium text-gray-700">Folder Path</label>
					<div class="flex gap-2">
						<input
							id="library-path-switcher"
							type="text"
							bind:value={newLibraryPath}
							placeholder="/media/photos"
							class="block flex-1 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500"
						/>
						<button 
							onclick={() => showFolderBrowserModal = true}
							class="px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 hover:border-gray-400"
						>
						Browse
						</button>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
				<button onclick={closeCreateModal} class="px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 hover:border-gray-400">
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

{#if showFolderBrowserModal}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={() => showFolderBrowserModal = false}
		onkeydown={(e) => e.key === 'Escape' && (showFolderBrowserModal = false)}
		role="dialog"
		aria-modal="true"
		aria-labelledby="folder-browser-title-switcher"
		tabindex="-1"
	>
		<div class="w-full max-w-2xl bg-white rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				<h3 id="folder-browser-title-switcher" class="text-lg font-semibold">Select Folder</h3>
				<button onclick={() => showFolderBrowserModal = false} class="flex items-center justify-center w-8 h-8 text-2xl text-gray-500 transition-colors hover:text-gray-900">
					×
				</button>
			</div>
			
			<div class="p-6">
				<FolderBrowser onSelect={handleFolderSelect} />
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
				<button 
					onclick={() => showFolderBrowserModal = false} 
					class="px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 hover:border-gray-400"
				>
					Cancel
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
