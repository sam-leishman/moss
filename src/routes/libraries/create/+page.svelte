<script lang="ts">
	import { goto } from '$app/navigation';
	import { Library as LibraryIcon, FolderOpen, X } from 'lucide-svelte';
	import FolderBrowser from '$lib/components/FolderBrowser.svelte';
	import { setLastLibraryId } from '$lib/utils/storage';

	let libraryName = $state('');
	let libraryPath = $state('');
	let showFolderBrowser = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);

	function handleFolderSelect(path: string) {
		libraryPath = path;
		showFolderBrowser = false;
	}

	async function createLibrary() {
		if (!libraryName.trim() || !libraryPath.trim()) {
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
					name: libraryName.trim(),
					folder_path: libraryPath.trim()
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create library');
			}

			const data = await response.json();
			
			// Save to localStorage and redirect to new library
			setLastLibraryId(data.library.id);
			goto(`/libraries/${data.library.id}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create library';
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !loading && libraryName.trim() && libraryPath.trim()) {
			createLibrary();
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4">
				<LibraryIcon class="w-8 h-8 text-blue-600 dark:text-blue-400" />
			</div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create Your First Library</h1>
			<p class="text-gray-600 dark:text-gray-400">
				A library is a collection of media files from a specific folder on your system.
			</p>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
			{#if error}
				<div class="flex items-center justify-between px-4 py-3 mb-4 text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
					<span class="text-sm">{error}</span>
					<button 
						onclick={() => error = null} 
						class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
						aria-label="Dismiss error"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="library-name" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
						Library Name
					</label>
					<input
						id="library-name"
						type="text"
						bind:value={libraryName}
						onkeydown={handleKeydown}
						placeholder="My Media Library"
						class="block w-full px-3 py-2 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
						autofocus
					/>
				</div>

				<div>
					<label for="library-path" class="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
						Folder Path
					</label>
					<div class="flex gap-2">
						<input
							id="library-path"
							type="text"
							bind:value={libraryPath}
							onkeydown={handleKeydown}
							placeholder="/media/photos"
							class="block flex-1 px-3 py-2 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
						/>
						<button 
							onclick={() => showFolderBrowser = true}
							class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
						>
							<FolderOpen class="w-4 h-4" />
							<span>Browse</span>
						</button>
					</div>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Select a folder containing your media files
					</p>
				</div>

				<button 
					onclick={createLibrary} 
					class="w-full px-4 py-2.5 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={loading || !libraryName.trim() || !libraryPath.trim()}
				>
					{loading ? 'Creating Library...' : 'Create Library'}
				</button>
			</div>
		</div>

		<p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
			You can create additional libraries later from the library switcher
		</p>
	</div>
</div>

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

			<div class="flex justify-end gap-2 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
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
