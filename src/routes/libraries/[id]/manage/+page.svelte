<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { RefreshCw, FolderOpen, Trash2, AlertTriangle, X, Info, Edit2, Check, Loader2 } from 'lucide-svelte';
	import FolderBrowser from '$lib/components/FolderBrowser.svelte';
	import type { PageData } from './$types';
	import { clearLastLibraryId, setLastLibraryId } from '$lib/utils/storage';

	let { data }: { data: PageData } = $props();

	let scanning = $state(false);
	let scanStats = $state<{ added: number; updated: number; removed: number } | null>(null);
	let showRelocateModal = $state(false);
	let showDeleteConfirm = $state(false);
	let showFolderBrowser = $state(false);
	let relocatePath = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let isEditingName = $state(false);
	let editedName = $state('');
	let isSavingName = $state(false);

	function getDisplayPath(fullPath: string): string {
		if (fullPath.includes('test-media')) {
			const parts = fullPath.split('test-media');
			return parts[1] ? `/media${parts[1]}` : '/media';
		}
		return fullPath;
	}

	async function scanLibrary() {
		if (scanning) return;

		scanning = true;
		error = null;
		scanStats = null;

		try {
			const response = await fetch(`/api/libraries/${data.library.id}/scan`, {
				method: 'POST'
			});

			const result = await response.json();

			if (!response.ok) {
				if (result.pathMissing) {
					const errorMessage = result.error || 'Library folder does not exist or is not accessible. Please relocate or delete this library.';
					await invalidateAll();
					error = errorMessage;
				} else {
					throw new Error(result.message || 'Failed to scan library');
				}
			} else {
				scanStats = {
					added: result.stats.added,
					updated: result.stats.updated,
					removed: result.stats.removed
				};

				if (result.errors && result.errors.length > 0) {
					error = `Scan completed with ${result.errors.length} error(s)`;
				}
				
				await invalidateAll();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to scan library';
		} finally {
			scanning = false;
		}
	}

	function openRelocateModal() {
		relocatePath = '';
		showRelocateModal = true;
		showFolderBrowser = false;
		error = null;
	}

	function closeRelocateModal() {
		showRelocateModal = false;
		relocatePath = '';
		showFolderBrowser = false;
		error = null;
	}

	function handleFolderSelect(path: string) {
		relocatePath = path;
		showFolderBrowser = false;
	}

	async function relocateLibrary() {
		if (!relocatePath.trim()) {
			error = 'Please select a folder path';
			return;
		}

		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/libraries/${data.library.id}/relocate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					folder_path: relocatePath.trim()
				})
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Failed to relocate library');
			}

			const result = await response.json();
			
			// Update local library data
			data.library = result.library;
			
			// Dispatch custom event to notify other components
			window.dispatchEvent(new CustomEvent('libraryUpdated', { 
				detail: { library: result.library } 
			}));
			
			await invalidateAll();
			successMessage = `Library relocated successfully to ${getDisplayPath(result.library.folder_path)}`;
			setTimeout(() => successMessage = null, 5000);
			closeRelocateModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to relocate library';
		} finally {
			loading = false;
		}
	}

	function openDeleteConfirm() {
		showDeleteConfirm = true;
		error = null;
	}

	function closeDeleteConfirm() {
		showDeleteConfirm = false;
	}

	async function deleteLibrary() {
		loading = true;
		error = null;

		try {
			// Fetch all libraries to determine next library
			const librariesResponse = await fetch('/api/libraries');
			if (!librariesResponse.ok) {
				throw new Error('Failed to fetch libraries');
			}
			const librariesData = await librariesResponse.json();
			const allLibraries = librariesData.libraries || [];
			
			// Find the next library (first one that's not the current library)
			const nextLibrary = allLibraries.find((lib: { id: number }) => lib.id !== data.library.id);
			
			// Delete the library
			const response = await fetch(`/api/libraries/${data.library.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Failed to delete library');
			}

			// Update localStorage with next library if available
			if (nextLibrary) {
				setLastLibraryId(nextLibrary.id);
			} else {
				clearLastLibraryId();
			}
			
			// Redirect to home (which will handle the redirect logic)
			goto('/');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete library';
		} finally {
			loading = false;
		}
	}

	function startEditingName() {
		editedName = data.library.name;
		isEditingName = true;
		error = null;
	}

	function cancelEditingName() {
		isEditingName = false;
		editedName = '';
		error = null;
	}

	async function saveLibraryName() {
		const trimmedName = editedName.trim();
		if (!trimmedName) {
			error = 'Library name cannot be empty';
			return;
		}

		if (trimmedName === data.library.name) {
			cancelEditingName();
			return;
		}

		isSavingName = true;
		error = null;

		try {
			const response = await fetch(`/api/libraries/${data.library.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmedName })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Failed to update library name');
			}

			const result = await response.json();
			
			// Update local library data
			data.library = result.library;
			
			// Dispatch custom event to notify other components
			window.dispatchEvent(new CustomEvent('libraryUpdated', { 
				detail: { library: result.library } 
			}));
			
			await invalidateAll();
			successMessage = `Library name updated successfully to "${result.library.name}"`;
			setTimeout(() => successMessage = null, 5000);
			isEditingName = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update library name';
		} finally {
			isSavingName = false;
		}
	}

	function handleNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveLibraryName();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEditingName();
		}
	}
</script>

<div class="max-w-4xl mx-auto space-y-6">
	<div>
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Manage Library</h1>
		<p class="mt-2 text-gray-600 dark:text-gray-400">
			Configure and maintain your library settings
		</p>
	</div>

	{#if error}
		<div class="flex items-center justify-between px-4 py-3 text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
			<span>{error}</span>
			<button 
				onclick={() => error = null} 
				class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
				aria-label="Dismiss error"
			>
				<X class="w-5 h-5" />
			</button>
		</div>
	{/if}

	{#if successMessage}
		<div class="flex items-center justify-between px-4 py-3 text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
			<span>{successMessage}</span>
			<button 
				onclick={() => successMessage = null} 
				class="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
				aria-label="Dismiss message"
			>
				<X class="w-5 h-5" />
			</button>
		</div>
	{/if}

	{#if scanStats}
		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
			<div class="flex items-start justify-between mb-3">
				<h4 class="font-semibold text-gray-900 dark:text-white">Scan Complete</h4>
				<button 
					onclick={() => scanStats = null} 
					class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
					aria-label="Dismiss"
				>
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

	<!-- Library Information -->
	<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Library Information</h2>
		</div>
		<div class="px-6 py-4 space-y-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
				{#if isEditingName}
					<div class="flex items-center gap-2">
						<input
							type="text"
							bind:value={editedName}
							onkeydown={handleNameKeydown}
							disabled={isSavingName}
							placeholder="Enter library name"
							class="flex-1 px-3 py-2 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
						/>
						<button
							type="button"
							onclick={saveLibraryName}
							disabled={isSavingName || !editedName.trim()}
							class="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#if isSavingName}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								<Check class="w-4 h-4" />
							{/if}
							{isSavingName ? 'Saving...' : 'Save'}
						</button>
						<button
							type="button"
							onclick={cancelEditingName}
							disabled={isSavingName}
							class="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<X class="w-4 h-4" />
							Cancel
						</button>
					</div>
				{:else}
					<div class="flex items-center justify-between">
						<p class="text-gray-900 dark:text-white font-medium">{data.library.name}</p>
						<button
							type="button"
							onclick={startEditingName}
							class="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
						>
							<Edit2 class="w-4 h-4" />
							Edit
						</button>
					</div>
				{/if}
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder Path</label>
				<p class="text-gray-900 dark:text-white font-mono text-sm break-all">
					{getDisplayPath(data.library.folder_path)}
				</p>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
				<div class="flex items-center gap-2">
					{#if data.library.path_status === 'ok'}
						<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
							<Info class="w-3.5 h-3.5" />
							Accessible
						</span>
					{:else}
						<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
							<AlertTriangle class="w-3.5 h-3.5" />
							Path Missing
						</span>
					{/if}
				</div>
				{#if data.library.path_error}
					<p class="mt-1 text-xs text-amber-600 dark:text-amber-500">{data.library.path_error}</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Library Actions -->
	<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Library Actions</h2>
		</div>
		<div class="px-6 py-4 space-y-4">
			<!-- Scan Library -->
			<div class="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
				<div class="flex-1">
					<h3 class="text-sm font-medium text-gray-900 dark:text-white">Scan Library</h3>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Scan the library folder for new, updated, or removed media files
					</p>
				</div>
				<button
					onclick={scanLibrary}
					disabled={scanning}
					class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<RefreshCw class="w-4 h-4 {scanning ? 'animate-spin' : ''}" />
					<span>{scanning ? 'Scanning...' : 'Scan Now'}</span>
				</button>
			</div>

			<!-- Relocate Library -->
			<div class="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
				<div class="flex-1">
					<h3 class="text-sm font-medium text-gray-900 dark:text-white">Relocate Library</h3>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Update the folder path if your media has been moved to a new location
					</p>
				</div>
				<button
					onclick={openRelocateModal}
					class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
				>
					<FolderOpen class="w-4 h-4" />
					<span>Relocate</span>
				</button>
			</div>

			<!-- Delete Library -->
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<h3 class="text-sm font-medium text-red-900 dark:text-red-200">Delete Library</h3>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Permanently remove this library and all its media records. Your files will not be deleted.
					</p>
				</div>
				<button
					onclick={openDeleteConfirm}
					class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-red-600 rounded-md hover:bg-red-700"
				>
					<Trash2 class="w-4 h-4" />
					<span>Delete</span>
				</button>
			</div>
		</div>
	</div>
</div>

<!-- Relocate Modal -->
{#if showRelocateModal}
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
				{#if error && showRelocateModal}
					<div class="px-3 py-2 mb-4 text-sm text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
						{error}
					</div>
				{/if}

				<div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
					<div class="flex items-start gap-2">
						<Info class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
						<div class="text-sm text-blue-800 dark:text-blue-200">
							<p class="font-medium mb-1">Update library location</p>
							<p>Select the new folder where your media files are located. All media paths will be updated automatically.</p>
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
							class="block flex-1 px-3 py-2 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
						/>
						<button 
							onclick={() => showFolderBrowser = true}
							class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
						>
							Browse
						</button>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button 
					onclick={closeRelocateModal} 
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
				>
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

<!-- Folder Browser Modal -->
{#if showFolderBrowser}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={() => showFolderBrowser = false}
		onkeydown={(e) => e.key === 'Escape' && (showFolderBrowser = false)}
		role="dialog"
		aria-modal="true"
		aria-labelledby="folder-browser-title"
		tabindex="-1"
	>
		<div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="folder-browser-title" class="text-lg font-semibold text-gray-900 dark:text-white">Select Folder</h3>
				<button onclick={() => showFolderBrowser = false} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<FolderBrowser onSelect={handleFolderSelect} />
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button 
					onclick={() => showFolderBrowser = false} 
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={closeDeleteConfirm}
		onkeydown={(e) => e.key === 'Escape' && closeDeleteConfirm()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-library-title"
		tabindex="-1"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="delete-library-title" class="text-lg font-semibold text-gray-900 dark:text-white">Delete Library</h3>
				<button onclick={closeDeleteConfirm} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
					<div class="flex items-start gap-2">
						<AlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
						<div class="text-sm text-red-800 dark:text-red-200">
							<p class="font-medium mb-1">This action cannot be undone</p>
							<p>All media records for this library will be permanently removed from the database.</p>
						</div>
					</div>
				</div>
				<p class="text-gray-900 dark:text-white">
					Are you sure you want to delete <strong>{data.library.name}</strong>?
				</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					Your actual media files will not be deleted from disk.
				</p>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button 
					onclick={closeDeleteConfirm} 
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
				>
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

<style>
	.animate-spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
