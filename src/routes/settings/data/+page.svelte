<script lang="ts">
	import { Database, Download, Upload, AlertCircle, CheckCircle, Trash2, X } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let backupLoading = $state(false);
	let backupMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let backupList = $state<Array<{ filename: string; size: number; created: string; modified: string }>>([]);
	let backupListLoading = $state(true);
	let restoreLoading = $state(false);
	let showRestoreConfirm = $state(false);
	let backupToRestore = $state<string | null>(null);
	let showMigrationWarning = $state(false);
	let migrationInfo = $state<{ backupVersion: number; currentVersion: number; message: string } | null>(null);
	let showDeleteConfirm = $state(false);
	let backupToDelete = $state<string | null>(null);
	let deleteLoading = $state(false);
	let exportLoading = $state(false);
	let exportMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let importLoading = $state(false);
	let importMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let importFile = $state<File | null>(null);

	const createBackup = async () => {
		backupLoading = true;
		backupMessage = null;
		
		try {
			const response = await fetch('/api/backup', {
				method: 'POST'
			});

			if (!response.ok) {
				let errorMessage = 'Failed to create backup';
				try {
					const error = await response.json();
					errorMessage = error.message || errorMessage;
				} catch {
					errorMessage = `Server error: ${response.status} ${response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			const result = await response.json();
			backupMessage = {
				type: 'success',
				text: `Backup created successfully: ${result.backupPath.split('/').pop()}`
			};
			
			await loadBackupList();
		} catch (error) {
			backupMessage = {
				type: 'error',
				text: error instanceof Error ? error.message : 'Failed to create backup'
			};
		} finally {
			backupLoading = false;
		}
	};

	const loadBackupList = async () => {
		backupListLoading = true;
		
		try {
			const response = await fetch('/api/backup/list');

			if (!response.ok) {
				throw new Error('Failed to load backup list');
			}

			const result = await response.json();
			backupList = result.backups;
		} catch (error) {
			backupMessage = {
				type: 'error',
				text: error instanceof Error ? error.message : 'Failed to load backup list'
			};
		} finally {
			backupListLoading = false;
		}
	};

	onMount(() => {
		loadBackupList();
	});

	const openRestoreConfirm = async (filename: string) => {
		backupToRestore = filename;
		backupMessage = null;
		
		try {
			const response = await fetch('/api/backup/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ backupFilename: filename })
			});

			if (!response.ok) {
				let errorMessage = 'Failed to check backup';
				try {
					const error = await response.json();
					errorMessage = error.message || errorMessage;
				} catch {
					errorMessage = `Server error: ${response.status} ${response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			const result = await response.json();
			
			if (result.isNewer) {
				backupMessage = {
					type: 'error',
					text: `Cannot restore: backup is from a newer version (${result.backupVersion}) than the current application (${result.currentVersion}). Please update the application first.`
				};
				backupToRestore = null;
				return;
			}
			
			if (result.requiresMigration) {
				migrationInfo = {
					backupVersion: result.backupVersion,
					currentVersion: result.currentVersion,
					message: `This backup is from an older database version (${result.backupVersion}). The current application uses version ${result.currentVersion}. The backup will be automatically migrated after restore.`
				};
				showMigrationWarning = true;
			} else {
				showRestoreConfirm = true;
			}
		} catch (error) {
			backupMessage = {
				type: 'error',
				text: error instanceof Error ? error.message : 'Failed to check backup'
			};
			backupToRestore = null;
		}
	};

	const cancelRestore = () => {
		showRestoreConfirm = false;
		showMigrationWarning = false;
		backupToRestore = null;
		migrationInfo = null;
	};

	const confirmRestore = async (confirmMigration = false) => {
		if (!backupToRestore) return;

		restoreLoading = true;
		backupMessage = null;
		showRestoreConfirm = false;
		showMigrationWarning = false;
		
		try {
			const response = await fetch('/api/backup/restore', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					backupFilename: backupToRestore,
					confirmMigration 
				})
			});

			if (!response.ok) {
				let errorMessage = 'Failed to restore backup';
				try {
					const error = await response.json();
					errorMessage = error.message || errorMessage;
				} catch {
					errorMessage = `Server error: ${response.status} ${response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			const result = await response.json();
		
		if (result.requiresConfirmation) {
			migrationInfo = {
				backupVersion: result.backupVersion,
				currentVersion: result.currentVersion,
				message: result.message
			};
			showMigrationWarning = true;
			restoreLoading = false;
			return;
		}
			
			backupMessage = {
				type: 'success',
				text: result.message
			};
		} catch (error) {
			backupMessage = {
				type: 'error',
				text: error instanceof Error ? error.message : 'Failed to restore backup'
			};
		} finally {
			restoreLoading = false;
			backupToRestore = null;
			migrationInfo = null;
		}
	};

	const formatFileSize = (bytes: number): string => {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	};

	const formatDate = (isoString: string): string => {
		const date = new Date(isoString);
		return date.toLocaleString();
	};

	const openDeleteConfirm = (filename: string) => {
		backupToDelete = filename;
		showDeleteConfirm = true;
	};

	const cancelDelete = () => {
		showDeleteConfirm = false;
		backupToDelete = null;
	};

	const confirmDelete = async () => {
		if (!backupToDelete) return;

		deleteLoading = true;
		backupMessage = null;
		showDeleteConfirm = false;
		
		try {
			const response = await fetch('/api/backup/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ backupFilename: backupToDelete })
			});

			if (!response.ok) {
				let errorMessage = 'Failed to delete backup';
				try {
					const error = await response.json();
					errorMessage = error.message || errorMessage;
				} catch {
					errorMessage = `Server error: ${response.status} ${response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			backupMessage = {
				type: 'success',
				text: 'Backup deleted successfully'
			};
			
			await loadBackupList();
		} catch (error) {
			backupMessage = {
				type: 'error',
				text: error instanceof Error ? error.message : 'Failed to delete backup'
			};
		} finally {
			deleteLoading = false;
			backupToDelete = null;
		}
	};

	const exportData = async () => {
		exportLoading = true;
		exportMessage = null;
		
		let downloadUrl: string | null = null;
		try {
			const response = await fetch('/api/export');

			if (!response.ok) {
				let errorMessage = 'Failed to export data';
				try {
					const error = await response.json();
					errorMessage = error.message || errorMessage;
				} catch {
					errorMessage = `Server error: ${response.status} ${response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			const data = await response.json();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			downloadUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = `xview-export-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			
			exportMessage = {
				type: 'success',
				text: 'Export completed successfully'
			};
		} catch (error) {
			exportMessage = {
				type: 'error',
				text: error instanceof Error ? error.message : 'Failed to export data'
			};
		} finally {
			if (downloadUrl) {
				URL.revokeObjectURL(downloadUrl);
			}
			exportLoading = false;
		}
	};

	const handleImportFileChange = (event: Event) => {
		const target = event.target as HTMLInputElement;
		importFile = target.files?.[0] || null;
		importMessage = null;
	};

	const importData = async () => {
		if (!importFile) return;

		importLoading = true;
		importMessage = null;
		
		try {
			const fileContent = await importFile.text();
			const data = JSON.parse(fileContent);

			const response = await fetch('/api/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (!response.ok) {
				let errorMessage = 'Failed to import data';
				try {
					const error = await response.json();
					errorMessage = error.message || errorMessage;
				} catch {
					errorMessage = `Server error: ${response.status} ${response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			const result = await response.json();
			importMessage = {
				type: 'success',
				text: `Import completed: ${result.stats.libraries.added} libraries, ${result.stats.media.added} media items added`
			};
			importFile = null;
			const fileInput = document.getElementById('import-file') as HTMLInputElement;
			if (fileInput) {
				fileInput.value = '';
			}
		} catch (error) {
			let errorMessage = 'Failed to import data';
			if (error instanceof SyntaxError) {
				errorMessage = 'Invalid JSON file. Please select a valid export file.';
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}
			importMessage = {
				type: 'error',
				text: errorMessage
			};
		} finally {
			importLoading = false;
		}
	};
</script>

<div class="px-6 py-6">
	<div class="max-w-4xl">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Data Management</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">Manage database backups and data import/export</p>
		</div>

		<section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
					<Database class="w-5 h-5" />
					Database Backups
				</h2>
				<button
					type="button"
					onclick={createBackup}
					disabled={backupLoading || restoreLoading || deleteLoading}
					class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{backupLoading ? 'Creating...' : 'Create Backup'}
				</button>
			</div>

			{#if backupMessage}
				<div class="mb-4 flex items-start gap-2 p-3 rounded-md {backupMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}">
					{#if backupMessage.type === 'success'}
						<CheckCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
					{:else}
						<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
					{/if}
					<p class="text-sm">{backupMessage.text}</p>
				</div>
			{/if}

			<div class="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
				{#if backupListLoading}
					<div class="p-8 text-center text-sm text-gray-600 dark:text-gray-400">
						Loading backups...
					</div>
				{:else if backupList.length === 0}
					<div class="p-8 text-center text-sm text-gray-600 dark:text-gray-400">
						No backups found
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
								<tr>
									<th class="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Created</th>
									<th class="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Size</th>
									<th class="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
								{#each backupList as backup}
									<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
										<td class="px-4 py-3 text-gray-900 dark:text-gray-100">
											{formatDate(backup.created)}
										</td>
										<td class="px-4 py-3 text-gray-600 dark:text-gray-400">
											{formatFileSize(backup.size)}
										</td>
										<td class="px-4 py-3 text-right">
											<div class="flex items-center justify-end gap-2">
												<button
													type="button"
													onclick={() => openRestoreConfirm(backup.filename)}
													disabled={backupLoading || restoreLoading || deleteLoading}
													class="px-3 py-1 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
												>
													Restore
												</button>
												<button
													type="button"
													onclick={() => openDeleteConfirm(backup.filename)}
													disabled={backupLoading || restoreLoading || deleteLoading}
													class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
													title="Delete backup"
												>
													<Trash2 class="w-4 h-4" />
												</button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</section>

		<section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
				<Download class="w-5 h-5" />
				Export & Import
			</h2>
			
			<div class="space-y-4">
				{#if exportMessage}
					<div class="flex items-start gap-2 p-3 rounded-md {exportMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}">
						{#if exportMessage.type === 'success'}
							<CheckCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
						{:else}
							<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
						{/if}
						<p class="text-sm">{exportMessage.text}</p>
					</div>
				{/if}
				
				<div>
					<button
						type="button"
						onclick={exportData}
						disabled={exportLoading}
						class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{exportLoading ? 'Exporting...' : 'Export All Data'}
					</button>
				</div>

				<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
					<div class="space-y-3">
						<div class="flex items-start gap-3">
							<div class="flex-1">
								<input
									id="import-file"
									type="file"
									accept=".json"
									onchange={handleImportFileChange}
									class="hidden"
								/>
								<label
									for="import-file"
									class="flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
								>
									<Upload class="w-4 h-4 mr-2" />
									{importFile ? importFile.name : 'Choose JSON file'}
								</label>
							</div>
							<button
								type="button"
								onclick={importData}
								disabled={importLoading || !importFile}
								class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{importLoading ? 'Importing...' : 'Import'}
							</button>
						</div>

						{#if importMessage}
							<div class="flex items-start gap-2 p-3 rounded-md {importMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}">
								{#if importMessage.type === 'success'}
									<CheckCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
								{:else}
									<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
								{/if}
								<p class="text-sm">{importMessage.text}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</section>
	</div>
</div>

<!-- Restore Confirmation Dialog -->
{#if showRestoreConfirm && backupToRestore}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={cancelRestore}
		onkeydown={(e) => e.key === 'Escape' && cancelRestore()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="restore-backup-title"
		tabindex="-1"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="restore-backup-title" class="text-lg font-semibold text-gray-900 dark:text-white">Restore Backup</h3>
				<button onclick={cancelRestore} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<p class="text-gray-900 dark:text-white">Restore from <strong>{backupList.find(b => b.filename === backupToRestore)?.created ? formatDate(backupList.find(b => b.filename === backupToRestore)!.created) : 'Unknown'}</strong>?</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">This will replace your current database. Consider creating a backup first if you want to preserve the current state.</p>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button onclick={cancelRestore} class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
					Cancel
				</button>
				<button 
					onclick={() => confirmRestore(false)} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={restoreLoading}
				>
					{restoreLoading ? 'Restoring...' : 'Restore Backup'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Migration Warning Dialog -->
{#if showMigrationWarning && backupToRestore && migrationInfo}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={cancelRestore}
		onkeydown={(e) => e.key === 'Escape' && cancelRestore()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="migration-warning-title"
		tabindex="-1"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="migration-warning-title" class="text-lg font-semibold text-gray-900 dark:text-white">Database Migration Required</h3>
				<button onclick={cancelRestore} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<div class="flex items-start gap-3 p-3 mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
					<AlertCircle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
					<div class="text-sm text-yellow-800 dark:text-yellow-200">
						<p class="font-medium mb-1">Schema Version Mismatch</p>
						<p>{migrationInfo.message}</p>
					</div>
				</div>
				
				<div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
					<p><strong>Backup version:</strong> {migrationInfo.backupVersion}</p>
					<p><strong>Current version:</strong> {migrationInfo.currentVersion}</p>
				</div>
				
				<p class="mt-4 text-sm text-gray-900 dark:text-white">
					The backup will be automatically migrated to the current schema version after restore. This process is safe and automatic.
				</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					Consider creating a backup of your current database before proceeding.
				</p>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button onclick={cancelRestore} class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
					Cancel
				</button>
				<button 
					onclick={() => confirmRestore(true)} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={restoreLoading}
				>
					{restoreLoading ? 'Restoring & Migrating...' : 'Restore & Migrate'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Dialog -->
{#if showDeleteConfirm && backupToDelete}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={cancelDelete}
		onkeydown={(e) => e.key === 'Escape' && cancelDelete()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-backup-title"
		tabindex="-1"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()} role="document">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="delete-backup-title" class="text-lg font-semibold text-gray-900 dark:text-white">Delete Backup</h3>
				<button onclick={cancelDelete} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<p class="text-gray-900 dark:text-white">Delete backup from <strong>{backupList.find(b => b.filename === backupToDelete)?.created ? formatDate(backupList.find(b => b.filename === backupToDelete)!.created) : 'Unknown'}</strong>?</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">This action cannot be undone.</p>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button onclick={cancelDelete} class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
					Cancel
				</button>
				<button 
					onclick={confirmDelete} 
					class="px-4 py-2 text-sm font-medium text-white transition-colors bg-red-600 rounded-md hover:bg-red-700"
				>
					Delete Backup
				</button>
			</div>
		</div>
	</div>
{/if}
