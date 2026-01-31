<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import FolderBrowser from './FolderBrowser.svelte';
	import type { Library } from '$lib/server/db';
	import { Trash2, X, AlertTriangle, FolderOpen } from 'lucide-svelte';

	interface Props {
		onLibraryChange?: (library: Library | null) => void;
	}

	let { onLibraryChange }: Props = $props();

	let libraries = $state<Library[]>([]);
	let showCreateModal = $state(false);
	let showDeleteConfirm = $state(false);
	let showRelocateModal = $state(false);
	let libraryToDelete = $state<Library | null>(null);
	let libraryToRelocate = $state<Library | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	let newLibraryName = $state('');
	let newLibraryPath = $state('');
	let relocatePath = $state('');
	let showFolderBrowserModal = $state(false);
	let showRelocateFolderBrowser = $state(false);

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
		onLibraryChange?.(library);
	}

	function openCreateModal() {
		newLibraryName = '';
		newLibraryPath = '';
		showCreateModal = true;
		showFolderBrowserModal = false;
	}

	function closeCreateModal() {
		showCreateModal = false;
		newLibraryName = '';
		newLibraryPath = '';
		showFolderBrowserModal = false;
	}

	async function createLibrary() {
		if (!newLibraryName.trim() || !newLibraryPath.trim()) {
			error = 'Library name and folder path are required';
			return;
		}

		loading = true;
		error = null;
		successMessage = null;
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
			
			closeCreateModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create library';
		} finally {
			loading = false;
		}
	}

	function confirmDelete(library: Library) {
		libraryToDelete = library;
		showDeleteConfirm = true;
	}

	function cancelDelete() {
		libraryToDelete = null;
		showDeleteConfirm = false;
	}

	async function deleteLibrary() {
		if (!libraryToDelete) return;

		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/libraries/${libraryToDelete.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to delete library');
			}

			libraries = libraries.filter(lib => lib.id !== libraryToDelete!.id);
			cancelDelete();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete library';
		} finally {
			loading = false;
		}
	}

	function handleFolderSelect(path: string) {
		newLibraryPath = path;
		showFolderBrowserModal = false;
	}

	function handleRelocateFolderSelect(path: string) {
		relocatePath = path;
		showRelocateFolderBrowser = false;
	}

	function openRelocateModal(library: Library) {
		libraryToRelocate = library;
		relocatePath = '';
		showRelocateModal = true;
		showRelocateFolderBrowser = false;
	}

	function closeRelocateModal() {
		showRelocateModal = false;
		libraryToRelocate = null;
		relocatePath = '';
		showRelocateFolderBrowser = false;
		error = null;
	}

	async function relocateLibrary() {
		if (!libraryToRelocate || !relocatePath.trim()) {
			error = 'Please select a folder path';
			return;
		}

		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/libraries/${libraryToRelocate.id}/relocate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					folder_path: relocatePath.trim()
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to relocate library');
			}

			const data = await response.json();
			libraries = libraries.map(lib => lib.id === data.library.id ? data.library : lib);
			await invalidateAll();
			successMessage = `Library relocated successfully to ${getDisplayPath(data.library.folder_path)}`;
			setTimeout(() => successMessage = null, 5000);
			closeRelocateModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to relocate library';
		} finally {
			loading = false;
		}
	}

	function getDisplayPath(fullPath: string): string {
		// Convert full system path to /media format for display
		// In development, this strips the test-media prefix
		// In production, paths should already be /media-based
		if (fullPath.includes('test-media')) {
			const parts = fullPath.split('test-media');
			return parts[1] ? `/media${parts[1]}` : '/media';
		}
		return fullPath;
	}
</script>

<div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
	{#if error}
		<div class="flex items-center justify-between px-4 py-3 mb-4 text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
			<span>{error}</span>
			<button onclick={() => error = null} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
				<X class="w-5 h-5" />
			</button>
		</div>
	{/if}
	
	{#if successMessage}
		<div class="flex items-center justify-between px-4 py-3 mb-4 text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
			<span>{successMessage}</span>
			<button onclick={() => successMessage = null} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
				<X class="w-5 h-5" />
			</button>
		</div>
	{/if}

	<div class="flex items-center justify-end mb-4">
		<button onclick={openCreateModal} class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700">
			+ New Library
		</button>
	</div>

	{#if loading && libraries.length === 0}
		<div class="py-8 text-center text-gray-500 dark:text-gray-400">Loading libraries...</div>
	{:else if libraries.length === 0}
		<div class="py-8 text-center text-gray-500 dark:text-gray-400">
			<p>No libraries yet. Create one to get started.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each libraries as library (library.id)}
				<div class="library-item {library.path_status === 'missing' || library.path_status === 'error' ? 'library-item-error' : ''}">
					<button 
						onclick={() => selectLibrary(library)}
						class="flex-1 p-2 text-left bg-transparent border-none cursor-pointer"
					>
						<div class="flex flex-col gap-1">
							<div class="flex items-center gap-2">
								<span class="font-semibold text-gray-900 dark:text-white">{library.name}</span>
								{#if library.path_status === 'missing' || library.path_status === 'error'}
									<span title={library.path_error || 'Path error'}>
										<AlertTriangle class="w-4 h-4 text-amber-600" />
									</span>
								{/if}
							</div>
							<span class="text-sm text-gray-600 dark:text-gray-400 font-mono">{getDisplayPath(library.folder_path)}</span>
							{#if library.path_error}
								<span class="text-xs text-amber-600 dark:text-amber-500">{library.path_error}</span>
							{/if}
						</div>
					</button>
					<div class="flex items-center gap-1">
						{#if library.path_status === 'missing' || library.path_status === 'error'}
							<button 
								onclick={() => openRelocateModal(library)}
								class="p-2 transition-opacity bg-transparent border-none cursor-pointer opacity-60 hover:opacity-100"
								title="Relocate library"
							>
								<FolderOpen class="w-5 h-5 text-blue-600" />
							</button>
						{/if}
						<button 
							onclick={() => confirmDelete(library)}
							class="p-2 transition-opacity bg-transparent border-none cursor-pointer opacity-60 hover:opacity-100"
							title="Delete library"
						>
							<Trash2 class="w-5 h-5 text-red-600" />
						</button>
					</div>
				</div>
			{/each}
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
		aria-labelledby="create-library-title"
		tabindex="-1"
	>
		<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="create-library-title" class="text-lg font-semibold text-gray-900 dark:text-white">Create New Library</h3>
				<button onclick={closeCreateModal} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<div class="mb-4">
					<label for="library-name" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Library Name</label>
					<input
						id="library-name"
						type="text"
						bind:value={newLibraryName}
						placeholder="My Media Library"
						class="block w-full rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<div class="mb-4">
					<label for="library-path" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Folder Path</label>
					<div class="flex gap-2">
						<input
							id="library-path"
							type="text"
							bind:value={newLibraryPath}
							placeholder="/media/photos"
							class="block flex-1 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500"
						/>
						<button 
							onclick={() => showFolderBrowserModal = true}
							class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
						>
							Browse
						</button>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button onclick={closeCreateModal} class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
					Cancel
				</button>
				<button 
					onclick={createLibrary} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={loading || !newLibraryName.trim() || !newLibraryPath.trim()}
				>
					{loading ? 'Creating...' : 'Create Library'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteConfirm && libraryToDelete}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={cancelDelete}
		onkeydown={(e) => e.key === 'Escape' && cancelDelete()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-library-title"
		tabindex="-1"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="delete-library-title" class="text-lg font-semibold text-gray-900 dark:text-white">Delete Library</h3>
				<button onclick={cancelDelete} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<p class="text-gray-900 dark:text-white">Are you sure you want to delete <strong>{libraryToDelete.name}</strong>?</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">This will remove all media records from this library. The actual files will not be deleted.</p>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button onclick={cancelDelete} class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
					Cancel
				</button>
				<button 
					onclick={deleteLibrary} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={loading}
				>
					{loading ? 'Deleting...' : 'Delete Library'}
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
		aria-labelledby="folder-browser-title"
		tabindex="-1"
	>
		<div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="folder-browser-title" class="text-lg font-semibold text-gray-900 dark:text-white">Select Folder</h3>
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
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showRelocateModal && libraryToRelocate}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={closeRelocateModal}
		onkeydown={(e) => e.key === 'Escape' && closeRelocateModal()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="relocate-library-title"
		tabindex="-1"
	>
		<div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="relocate-library-title" class="text-lg font-semibold text-gray-900 dark:text-white">Relocate Library</h3>
				<button onclick={closeRelocateModal} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				{#if error}
					<div class="px-3 py-2 mb-4 text-sm text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
						{error}
					</div>
				{/if}

				<div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
					<div class="flex items-start gap-2">
						<AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
						<div class="text-sm text-amber-800 dark:text-amber-200">
							<p class="font-medium mb-1">Library path is not accessible</p>
							<p>The folder for <strong>{libraryToRelocate.name}</strong> cannot be found. Select the new location to restore access to your media.</p>
						</div>
					</div>
				</div>

				<div class="mb-4">
					<label for="relocate-path" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">New Folder Path</label>
					<div class="flex gap-2">
						<input
							id="relocate-path"
							type="text"
							bind:value={relocatePath}
							placeholder="/media/photos"
							class="block flex-1 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500"
						/>
						<button 
							onclick={() => showRelocateFolderBrowser = true}
							class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
						>
							Browse
						</button>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button onclick={closeRelocateModal} class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
					Cancel
				</button>
				<button 
					onclick={relocateLibrary} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={loading || !relocatePath.trim()}
				>
					{loading ? 'Relocating...' : 'Relocate Library'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showRelocateFolderBrowser}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={() => showRelocateFolderBrowser = false}
		onkeydown={(e) => e.key === 'Escape' && (showRelocateFolderBrowser = false)}
		role="dialog"
		aria-modal="true"
		aria-labelledby="relocate-folder-browser-title"
		tabindex="-1"
	>
		<div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="relocate-folder-browser-title" class="text-lg font-semibold text-gray-900 dark:text-white">Select New Folder</h3>
				<button onclick={() => showRelocateFolderBrowser = false} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<FolderBrowser onSelect={handleRelocateFolderSelect} />
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button 
					onclick={() => showRelocateFolderBrowser = false} 
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.library-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		padding: 0.5rem;
		transition: all 0.2s;
	}

	.library-item:hover {
		border-color: #3b82f6;
		background: #eff6ff;
	}

	.library-item-error {
		border-color: #f59e0b;
		background: #fffbeb;
	}

	.library-item-error:hover {
		border-color: #d97706;
		background: #fef3c7;
	}

	@media (prefers-color-scheme: dark) {
		:global(.dark) .library-item {
			border-color: #374151;
		}

		:global(.dark) .library-item:hover {
			background: rgba(30, 58, 138, 0.125);
		}

		:global(.dark) .library-item-error {
			border-color: #d97706;
			background: rgba(217, 119, 6, 0.1);
		}

		:global(.dark) .library-item-error:hover {
			border-color: #f59e0b;
			background: rgba(245, 158, 11, 0.15);
		}
	}
</style>
