<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import FolderBrowser from './FolderBrowser.svelte';
	import type { Library } from '$lib/server/db';
	import { Library as LibraryIcon, ChevronDown, Check, RefreshCw, Plus, X } from 'lucide-svelte';
	import { fetchLibraries } from '$lib/utils/api';
	import { setLastLibraryId } from '$lib/utils/storage';

	interface Props {
		libraryId?: number | null;
	}

	let { libraryId }: Props = $props();

	let currentLibrary = $state<Library | null>(null);

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
		
		// Listen for library update events
		const handleLibraryUpdate = (event: CustomEvent<{ library: Library }>) => {
			const { library } = event.detail;
			
			// Update the libraries array with the updated library
			libraries = libraries.map(lib => lib.id === library.id ? library : lib);
			
			// Update current library if it's the one that was updated
			if (currentLibrary?.id === library.id) {
				currentLibrary = library;
			}
		};
		
		window.addEventListener('libraryUpdated', handleLibraryUpdate as EventListener);
		
		return () => {
			window.removeEventListener('libraryUpdated', handleLibraryUpdate as EventListener);
		};
	});

	// Load current library data when libraryId changes
	$effect(() => {
		if (libraryId && libraries.length > 0) {
			currentLibrary = libraries.find(lib => lib.id === libraryId) || null;
		} else {
			currentLibrary = null;
		}
	});

	async function loadLibraries() {
		loading = true;
		error = null;
		try {
			libraries = await fetchLibraries();
			// Update current library if we have a libraryId
			if (libraryId) {
				currentLibrary = libraries.find(lib => lib.id === libraryId) || null;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load libraries';
		} finally {
			loading = false;
		}
	}

	function selectLibrary(library: Library) {
		showDropdown = false;
		setLastLibraryId(library.id);
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
			setLastLibraryId(data.library.id);
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

			const data = await response.json();

			if (!response.ok) {
				if (data.pathMissing) {
					const errorMessage = data.error || 'Library folder does not exist or is not accessible. Please relocate or delete this library.';
					await loadLibraries();
					await invalidateAll();
					error = errorMessage;
				} else {
					throw new Error(data.message || 'Failed to scan library');
				}
			} else {
				scanStats = {
					added: data.stats.added,
					updated: data.stats.updated,
					removed: data.stats.removed
				};

				if (data.errors && data.errors.length > 0) {
					error = `Scan completed with ${data.errors.length} error(s)`;
				}
				
				await loadLibraries();
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
		class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
	>
		<LibraryIcon class="w-5 h-5" />
		<span>{currentLibrary?.name || 'Select Library'}</span>
		<ChevronDown class="w-4 h-4 transition-transform {showDropdown ? 'rotate-180' : ''}" />
	</button>

	{#if showDropdown}
		<div class="absolute right-0 z-50 w-64 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
			<div class="py-1">
				{#if libraries.length === 0}
					<div class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No libraries yet</div>
				{:else}
					{#each libraries as library (library.id)}
						<button
							onclick={() => selectLibrary(library)}
							class={`flex items-center w-full gap-2 px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${currentLibrary?.id === library.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''}`}
						>
							<span class="flex-1 truncate">{library.name}</span>
							{#if currentLibrary?.id === library.id}
								<Check class="w-4 h-4" />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
			{#if currentLibrary}
				<div class="border-t border-gray-200 dark:border-gray-700">
					<button
						onclick={scanLibrary}
						disabled={scanning}
						class="flex items-center w-full gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<RefreshCw class="w-4 h-4 {scanning ? 'animate-spin' : ''}" />
						<span>{scanning ? 'Scanning...' : 'Scan Library'}</span>
					</button>
				</div>
			{/if}
			<div class="border-t border-gray-200 dark:border-gray-700">
				<button
					onclick={openCreateModal}
					class="flex items-center w-full gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
				>
					<Plus class="w-4 h-4" />
					<span>New Library</span>
				</button>
			</div>
		</div>
	{/if}

	{#if error}
		<div class="fixed top-20 right-6 z-50 w-80 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4">
			<div class="flex items-start justify-between mb-3">
				<h4 class="font-semibold text-red-900 dark:text-red-200">Scan Error</h4>
				<button onclick={() => error = null} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-5 h-5" />
				</button>
			</div>
			<p class="text-sm text-red-800 dark:text-red-200">{error}</p>
		</div>
	{:else if scanStats}
		<div class="fixed top-20 right-6 z-50 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
			<div class="flex items-start justify-between mb-3">
				<h4 class="font-semibold text-gray-900 dark:text-white">Scan Complete</h4>
				<button onclick={() => scanStats = null} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-5 h-5" />
				</button>
			</div>
			<div class="space-y-2 text-sm">
				{#if scanStats.added > 0}
					<div class="flex justify-between">
						<span class="text-gray-600 dark:text-gray-400">Added:</span>
						<span class="font-medium text-green-600">{scanStats.added}</span>
					</div>
				{/if}
				{#if scanStats.updated > 0}
					<div class="flex justify-between">
						<span class="text-gray-600 dark:text-gray-400">Updated:</span>
						<span class="font-medium text-blue-600">{scanStats.updated}</span>
					</div>
				{/if}
				{#if scanStats.removed > 0}
					<div class="flex justify-between">
						<span class="text-gray-600 dark:text-gray-400">Removed:</span>
						<span class="font-medium text-red-600">{scanStats.removed}</span>
					</div>
				{/if}
				{#if scanStats.added === 0 && scanStats.updated === 0 && scanStats.removed === 0}
					<p class="text-gray-500 dark:text-gray-400">No changes detected</p>
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
		<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="create-library-title-switcher" class="text-lg font-semibold text-gray-900 dark:text-white">Create New Library</h3>
				<button onclick={closeCreateModal} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				{#if error}
					<div class="px-3 py-2 mb-4 text-sm text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
						{error}
					</div>
				{/if}

				<div class="mb-4">
					<label for="library-name-switcher" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Library Name</label>
					<input
						id="library-name-switcher"
						type="text"
						bind:value={newLibraryName}
						placeholder="My Media Library"
						class="block w-full rounded-md text-sm focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<div class="mb-4">
					<label for="library-path-switcher" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Folder Path</label>
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
							class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
						>
						Browse
						</button>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button onclick={closeCreateModal} class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500">
					Cancel
				</button>
				<button 
					onclick={createLibrary} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
		<div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="folder-browser-title-switcher" class="text-lg font-semibold text-gray-900 dark:text-white">Select Folder</h3>
				<button onclick={() => showFolderBrowserModal = false} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<FolderBrowser onSelect={handleFolderSelect} />
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button 
					onclick={() => showFolderBrowserModal = false} 
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
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
