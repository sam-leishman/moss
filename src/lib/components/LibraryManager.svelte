<script lang="ts">
	import { onMount } from 'svelte';
	import FolderBrowser from './FolderBrowser.svelte';
	import type { Library } from '$lib/server/db';

	interface Props {
		onLibraryChange?: (library: Library | null) => void;
	}

	let { onLibraryChange }: Props = $props();

	let libraries = $state<Library[]>([]);
	let selectedLibrary = $state<Library | null>(null);
	let showCreateModal = $state(false);
	let showDeleteConfirm = $state(false);
	let libraryToDelete = $state<Library | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
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
			
			if (selectedLibrary?.id === libraryToDelete.id) {
				selectedLibrary = libraries.length > 0 ? libraries[0] : null;
				onLibraryChange?.(selectedLibrary);
			}

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

<div class="p-4 bg-white rounded-lg shadow-sm">
	{#if error}
		<div class="flex items-center justify-between px-4 py-3 mb-4 text-red-800 bg-red-100 border border-red-200 rounded-md">
			<span>{error}</span>
			<button onclick={() => error = null} class="flex items-center justify-center w-8 h-8 text-2xl text-gray-500 transition-colors hover:text-gray-900">
				×
			</button>
		</div>
	{/if}
	
	{#if successMessage}
		<div class="flex items-center justify-between px-4 py-3 mb-4 text-green-800 bg-green-100 border border-green-200 rounded-md">
			<span>{successMessage}</span>
			<button onclick={() => successMessage = null} class="flex items-center justify-center w-8 h-8 text-2xl text-gray-500 transition-colors hover:text-gray-900">
				×
			</button>
		</div>
	{/if}

	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-semibold">Libraries</h2>
		<button onclick={openCreateModal} class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-500 rounded-md hover:bg-blue-600">
			+ New Library
		</button>
	</div>

	{#if loading && libraries.length === 0}
		<div class="py-8 text-center text-gray-500">Loading libraries...</div>
	{:else if libraries.length === 0}
		<div class="py-8 text-center text-gray-500">
			<p>No libraries yet. Create one to get started.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each libraries as library (library.id)}
				<div 
					class="library-item"
					class:selected={selectedLibrary?.id === library.id}
				>
					<button 
						onclick={() => selectLibrary(library)}
						class="flex-1 p-2 text-left bg-transparent border-none cursor-pointer"
					>
						<div class="flex flex-col gap-1">
							<span class="font-semibold text-gray-900">{library.name}</span>
							<span class="text-sm text-gray-600 font-mono">{getDisplayPath(library.folder_path)}</span>
						</div>
					</button>
					<button 
						onclick={() => confirmDelete(library)}
						class="p-2 text-xl transition-opacity bg-transparent border-none cursor-pointer opacity-60 hover:opacity-100"
						title="Delete library"
					>
						🗑️
					</button>
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
		<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				<h3 id="create-library-title" class="text-lg font-semibold">Create New Library</h3>
				<button onclick={closeCreateModal} class="flex items-center justify-center w-8 h-8 text-2xl text-gray-500 transition-colors hover:text-gray-900">
					×
				</button>
			</div>
			
			<div class="p-6">
				<div class="mb-4">
					<label for="library-name" class="block mb-2 text-sm font-medium text-gray-700">Library Name</label>
					<input
						id="library-name"
						type="text"
						bind:value={newLibraryName}
						placeholder="My Media Library"
						class="block w-full rounded-md text-sm focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<div class="mb-4">
					<label for="library-path" class="block mb-2 text-sm font-medium text-gray-700">Folder Path</label>
					<div class="flex gap-2">
						<input
							id="library-path"
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
				<button onclick={closeCreateModal} class="px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-gray-200 rounded-md hover:bg-gray-300">
					Cancel
				</button>
				<button 
					onclick={createLibrary} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
		<div class="w-full max-w-md bg-white rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				<h3 id="delete-library-title" class="text-lg font-semibold">Delete Library</h3>
				<button onclick={cancelDelete} class="flex items-center justify-center w-8 h-8 text-2xl text-gray-500 transition-colors hover:text-gray-900">
					×
				</button>
			</div>
			
			<div class="p-6">
				<p>Are you sure you want to delete <strong>{libraryToDelete.name}</strong>?</p>
				<p class="mt-2 text-sm text-gray-600">This will remove all media records from this library. The actual files will not be deleted.</p>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
				<button onclick={cancelDelete} class="px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-gray-200 rounded-md hover:bg-gray-300">
					Cancel
				</button>
				<button 
					onclick={deleteLibrary} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
		<div class="w-full max-w-2xl bg-white rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				<h3 id="folder-browser-title" class="text-lg font-semibold">Select Folder</h3>
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
	/* Only keep truly custom component-specific styles */
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

	.library-item.selected {
		border-color: #3b82f6;
		background: #dbeafe;
	}
</style>
