<script lang="ts">
	import { Plus, Trash2, Pencil, User, Globe, Upload, X } from 'lucide-svelte';
	import type { Person } from '$lib/server/db';
	import { fetchLibraries } from '$lib/utils/api';

	interface Props {
		libraryId?: number;
	}

	let { libraryId }: Props = $props();

	let people = $state<Person[]>([]);
	let libraries = $state<Map<number, string>>(new Map());
	
	// Derived state for proper reactivity
	let globalPeople = $derived(() => people.filter(p => p.is_global === 1));
	let libraryPeople = $derived(() => people.filter(p => p.is_global === 0));
	let peopleByLibrary = $derived(() => {
		const map = new Map<number, Person[]>();
		for (const person of libraryPeople()) {
			const libId = person.library_id as number;
			const existing = map.get(libId) || [];
			map.set(libId, [...existing, person]);
		}
		return map;
	});
	let loading = $state(false);
	let error = $state<string | null>(null);
	let showCreateModal = $state(false);
	let editingPerson = $state<Person | null>(null);
	let previousLibraryId = $state<number | undefined | null>(null);

	let newPersonName = $state('');
	let newPersonRole = $state<'artist' | 'performer'>('artist');
	let newPersonStyle = $state<string>('');
	let newPersonAge = $state<number | null>(null);
	let isGlobal = $state(false);
	let showCrossLibraryWarning = $state(false);
	let crossLibraryUsage = $state<Array<{ library_id: number; library_name: string; count: number }>>([]);
	let totalAffectedItems = $state(0);
	let uploadingImage = $state(false);
	let imageUploadError = $state<string | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let pendingImageFile = $state<File | null>(null);
	let pendingImagePreview = $state<string | null>(null);
	let pendingImageAction = $state<'upload' | 'delete' | null>(null);

	const loadPeople = async () => {
		loading = true;
		error = null;
		try {
			const url = libraryId ? `/api/people?library_id=${libraryId}` : '/api/people';
			const response = await fetch(url);
			if (!response.ok) throw new Error('Failed to fetch people');
			const newPeople = await response.json();
			people = newPeople;
			// Load library names for library-specific people
			const libraryIds = new Set(people.filter(p => p.library_id !== null).map(p => p.library_id as number));
			if (libraryIds.size > 0) {
				const allLibraries = await fetchLibraries();
				const libMap = new Map<number, string>();
				for (const lib of allLibraries) {
					if (libraryIds.has(lib.id)) {
						libMap.set(lib.id, lib.name);
					}
				}
				libraries = libMap;
			}
		} catch (err) {
			console.error('Error loading people:', err);
			error = err instanceof Error ? err.message : 'Failed to load people';
		} finally {
			loading = false;
		}
	};

	const createPerson = async () => {
		if (!newPersonName.trim()) {
			error = 'Person name is required';
			return;
		}

		if (!isGlobal && !libraryId) {
			error = 'Library ID is required for library-specific people';
			return;
		}

		loading = true;
		error = null;
		try {
			const profile = newPersonRole === 'artist' 
				? { style: newPersonStyle || null }
				: { age: newPersonAge };

			const response = await fetch('/api/people', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newPersonName,
					role: newPersonRole,
					profile,
					library_id: libraryId,
					is_global: isGlobal
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create person');
			}

			newPersonName = '';
			newPersonStyle = '';
			newPersonAge = null;
			isGlobal = false;
			showCreateModal = false;
			await loadPeople();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create person';
		} finally {
			loading = false;
		}
	};

	const updatePerson = async (force = false) => {
		if (!editingPerson) return;

		if (!isGlobal && !libraryId) {
			error = 'Library ID is required for library-specific people';
			return;
		}

		loading = true;
		error = null;
		try {
			const profile = editingPerson.role === 'artist'
				? { style: newPersonStyle || null }
				: { age: newPersonAge };

			const response = await fetch(`/api/people/${editingPerson.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newPersonName,
					profile,
					library_id: libraryId,
					is_global: isGlobal,
					force
				})
			});

			if (response.status === 409) {
				const data = await response.json();
				if (data.error === 'cross_library_usage') {
					crossLibraryUsage = data.usage;
					totalAffectedItems = data.totalItems;
					showCrossLibraryWarning = true;
					loading = false;
					return;
				}
			}

			if (!response.ok) {
				if (pendingImagePreview) {
					URL.revokeObjectURL(pendingImagePreview);
				}
				const data = await response.json();
				throw new Error(data.message || 'Failed to update person');
			}

			// Commit pending image changes
			if (pendingImageAction === 'upload' && pendingImageFile && editingPerson) {
				try {
					const formData = new FormData();
					formData.append('image', pendingImageFile);

					const imgResponse = await fetch(`/api/people/${editingPerson.id}/image`, {
						method: 'POST',
						body: formData
					});

					if (!imgResponse.ok) {
						if (pendingImagePreview) {
							URL.revokeObjectURL(pendingImagePreview);
						}
						const data = await imgResponse.json();
						throw new Error(data.message || 'Failed to upload image');
					}
				} catch (imgErr) {
					if (pendingImagePreview) {
						URL.revokeObjectURL(pendingImagePreview);
					}
					error = imgErr instanceof Error ? imgErr.message : 'Failed to upload image';
					loading = false;
					return;
				}
			} else if (pendingImageAction === 'delete' && editingPerson) {
				try {
					const imgResponse = await fetch(`/api/people/${editingPerson.id}/image`, {
						method: 'DELETE'
					});

					if (!imgResponse.ok) {
						if (pendingImagePreview) {
							URL.revokeObjectURL(pendingImagePreview);
						}
						const data = await imgResponse.json();
						throw new Error(data.message || 'Failed to delete image');
					}
				} catch (imgErr) {
					if (pendingImagePreview) {
						URL.revokeObjectURL(pendingImagePreview);
					}
					error = imgErr instanceof Error ? imgErr.message : 'Failed to delete image';
					loading = false;
					return;
				}
			}

			if (pendingImagePreview) {
				URL.revokeObjectURL(pendingImagePreview);
			}
			showCrossLibraryWarning = false;
			editingPerson = null;
			newPersonName = '';
			newPersonStyle = '';
			newPersonAge = null;
			isGlobal = false;
			imageUploadError = null;
			pendingImageFile = null;
			pendingImagePreview = null;
			pendingImageAction = null;
			await loadPeople();
		} catch (err) {
			if (pendingImagePreview) {
				URL.revokeObjectURL(pendingImagePreview);
			}
			error = err instanceof Error ? err.message : 'Failed to update person';
		} finally {
			loading = false;
		}
	};

	const confirmForceUpdate = async () => {
		showCrossLibraryWarning = false;
		await updatePerson(true);
	};

	const cancelForceUpdate = () => {
		showCrossLibraryWarning = false;
		isGlobal = true;
	};

	const deletePerson = async (id: number) => {
		if (!confirm('Are you sure you want to delete this person? All credits will be removed.')) {
			return;
		}

		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/people/${id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to delete person');
			}

			await loadPeople();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete person';
		} finally {
			loading = false;
		}
	};

	const startEdit = async (person: Person) => {
		editingPerson = person;
		newPersonName = person.name;
		newPersonRole = person.role;
		isGlobal = person.is_global === 1;
		pendingImageFile = null;
		pendingImagePreview = null;
		pendingImageAction = null;
		imageUploadError = null;
		
		try {
			const response = await fetch(`/api/people/${person.id}`);
			if (response.ok) {
				const data = await response.json();
				if (data.profile) {
					if (person.role === 'artist') {
						newPersonStyle = data.profile.style || '';
					} else if (person.role === 'performer') {
						newPersonAge = data.profile.age;
					}
				}
			}
		} catch (err) {
			console.error('Failed to load profile', err);
		}
	};

	const cancelEdit = () => {
		if (!editingPerson) return;

		// Clean up pending image preview
		if (pendingImagePreview) {
			URL.revokeObjectURL(pendingImagePreview);
		}

		editingPerson = null;
		newPersonName = '';
		newPersonStyle = '';
		newPersonAge = null;
		isGlobal = false;
		imageUploadError = null;
		pendingImageFile = null;
		pendingImagePreview = null;
		pendingImageAction = null;
	};

	const handleImageUpload = (event: Event) => {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		
		if (!file || !editingPerson) return;

		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			imageUploadError = 'Image must be smaller than 10MB';
			return;
		}

		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			imageUploadError = 'Only JPEG, PNG, and WebP images are allowed';
			return;
		}

		imageUploadError = null;

		if (pendingImagePreview) {
			URL.revokeObjectURL(pendingImagePreview);
		}

		pendingImageFile = file;
		pendingImagePreview = URL.createObjectURL(file);
		pendingImageAction = 'upload';

		if (input) input.value = '';
	};

	const handleDeleteImage = () => {
		if (!editingPerson || !confirm('Are you sure you want to delete this image?')) return;

		imageUploadError = null;

		if (pendingImagePreview) {
			URL.revokeObjectURL(pendingImagePreview);
			pendingImagePreview = null;
		}

		pendingImageFile = null;
		pendingImageAction = 'delete';
	};

	const openCreateModal = () => {
		newPersonName = '';
		newPersonRole = 'artist';
		newPersonStyle = '';
		newPersonAge = null;
		isGlobal = false;
		showCreateModal = true;
	};

	$effect(() => {
		// Reload when library changes
		if (libraryId !== previousLibraryId) {
			previousLibraryId = libraryId;
			loadPeople();
		}
	});
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold text-gray-900 dark:text-white">People</h2>
		{#if libraryId !== undefined}
			<button
				type="button"
				onclick={openCreateModal}
				class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
			>
				<Plus class="w-4 h-4" />
				Add Person
			</button>
		{/if}
	</div>

	{#if error}
		<div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200">
			{error}
		</div>
	{/if}

	{#if loading && people.length === 0}
		<div class="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
	{:else if people.length === 0}
		<div class="text-center py-8 text-gray-500 dark:text-gray-400">
			No people added yet. Click "Add Person" to get started.
		</div>
	{:else}
		<div class="space-y-6">
			{#if globalPeople().length > 0}
				<div>
					<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Global People ({globalPeople().length})</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each globalPeople() as person (person.id)}
							<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:shadow-md transition-shadow">
								<div class="flex items-start justify-between">
									<a href={libraryId ? `/libraries/${libraryId}/people/${person.id}` : `/people/${person.id}`} class="flex items-center gap-3 flex-1 min-w-0 group">
										<div class="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
											{#if person.image_path}
												{#key `${person.id}-${person.updated_at}`}
													<img 
														src="/api/images/people/{person.image_path}?v={new Date(person.updated_at).getTime()}" 
														alt={person.name} 
														class="w-full h-full object-cover"
													/>
												{/key}
											{:else}
												<User class="w-5 h-5 text-blue-600 dark:text-blue-400" />
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<h3 class="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{person.name}</h3>
												<Globe class="w-3 h-3 text-blue-500 dark:text-blue-400" />
											</div>
											<p class="text-sm text-gray-500 dark:text-gray-400 capitalize">{person.role}</p>
										</div>
									</a>
									<div class="flex gap-2">
										<button
											type="button"
											onclick={() => startEdit(person)}
											class="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
											aria-label="Edit person"
										>
											<Pencil class="w-4 h-4" />
										</button>
										<button
											type="button"
											onclick={() => deletePerson(person.id)}
											class="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
											aria-label="Delete person"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			
			{#if peopleByLibrary().size > 0}
					{#each Array.from(peopleByLibrary().entries()).sort((a, b) => {
						const nameA = libraries.get(a[0]) || '';
						const nameB = libraries.get(b[0]) || '';
						return nameA.localeCompare(nameB);
					}) as [libId, libPeople] (libId)}
					<div>
							<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
								{libraries.get(libId) || `Library ${libId}`} ({libPeople.length})
							</h3>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each libPeople as person (person.id)}
								<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
									<div class="flex items-start justify-between">
										<a href={libraryId ? `/libraries/${libraryId}/people/${person.id}` : `/people/${person.id}`} class="flex items-center gap-3 flex-1 min-w-0 group">
										<div class="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
											{#if person.image_path}
												{#key `${person.id}-${person.updated_at}`}
													<img 
														src="/api/images/people/{person.image_path}?v={new Date(person.updated_at).getTime()}" 
														alt={person.name} 
														class="w-full h-full object-cover"
													/>
												{/key}
											{:else}
												<User class="w-5 h-5 text-gray-600 dark:text-gray-400" />
											{/if}
										</div>
										<div class="flex-1 min-w-0">
												<h3 class="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{person.name}</h3>
												<p class="text-sm text-gray-500 dark:text-gray-400 capitalize">{person.role}</p>
											</div>
										</a>
										<div class="flex gap-2">
											<button
												type="button"
												onclick={() => startEdit(person)}
												class="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
												aria-label="Edit person"
											>
												<Pencil class="w-4 h-4" />
											</button>
											<button
												type="button"
												onclick={() => deletePerson(person.id)}
												class="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
												aria-label="Delete person"
											>
												<Trash2 class="w-4 h-4" />
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

{#if showCreateModal}
	<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
			<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Person</h3>
			
			<div class="space-y-4">
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Name
					</label>
					<input
						type="text"
						id="name"
						bind:value={newPersonName}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						placeholder="Enter person name"
					/>
				</div>

				<div>
					<label for="role" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Role
					</label>
					<select
						id="role"
						bind:value={newPersonRole}
						class="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="artist">Artist</option>
						<option value="performer">Performer</option>
					</select>
				</div>

				{#if newPersonRole === 'artist'}
					<div>
						<label for="style" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Style (Optional)
						</label>
						<select
							id="style"
							bind:value={newPersonStyle}
							class="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="">Not specified</option>
							<option value="2d_animator">2D Animator</option>
							<option value="3d_animator">3D Animator</option>
							<option value="illustrator">Illustrator</option>
							<option value="photographer">Photographer</option>
							<option value="other">Other</option>
						</select>
					</div>
				{:else if newPersonRole === 'performer'}
					<div>
						<label for="age" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Age (Optional)
						</label>
						<input
							type="number"
							id="age"
							bind:value={newPersonAge}
							min="0"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Enter age"
						/>
					</div>
				{/if}
				
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => isGlobal = !isGlobal}
						aria-label="Toggle global person"
						class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {isGlobal ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}"
					>
						<span class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform {isGlobal ? 'translate-x-5' : 'translate-x-1'}"></span>
					</button>
					<span class="text-sm text-gray-700 dark:text-gray-300">
						Global
					</span>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					type="button"
					onclick={() => { showCreateModal = false; }}
					class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={createPerson}
					disabled={loading}
					class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
				>
					{loading ? 'Creating...' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if editingPerson}
	<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
			<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Person</h3>
			
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Profile Image
					</label>
					<div class="flex items-center gap-4">
						<div class="relative group">
							<div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
								{#if pendingImageAction === 'upload' && pendingImagePreview}
									<img 
										src={pendingImagePreview} 
										alt={editingPerson.name} 
										class="w-full h-full object-cover"
									/>
								{:else if pendingImageAction === 'delete'}
									<User class="w-8 h-8 text-gray-600 dark:text-gray-400" />
								{:else if editingPerson.image_path}
									<img 
										src="/api/images/people/{editingPerson.image_path}?v={new Date(editingPerson.updated_at).getTime()}" 
										alt={editingPerson.name} 
										class="w-full h-full object-cover"
									/>
								{:else}
									<User class="w-8 h-8 text-gray-600 dark:text-gray-400" />
								{/if}
							</div>
							{#if pendingImageAction}
								<div class="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center" title="Pending change">
									<span class="text-white text-xs font-bold">!</span>
								</div>
							{/if}
						</div>
						<div class="flex gap-2">
							<input
								type="file"
								accept="image/jpeg,image/jpg,image/png,image/webp"
								onchange={handleImageUpload}
								class="hidden"
								bind:this={fileInputRef}
								disabled={uploadingImage}
							/>
							<button
								type="button"
								onclick={() => fileInputRef?.click()}
								class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
								disabled={uploadingImage}
							>
								<Upload class="w-4 h-4" />
								Upload
							</button>
							{#if (editingPerson.image_path && pendingImageAction !== 'delete') || pendingImageAction === 'upload'}
								<button
									type="button"
									onclick={handleDeleteImage}
									class="px-3 py-1.5 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
									disabled={uploadingImage}
								>
									<X class="w-4 h-4" />
									Remove
								</button>
							{/if}
						</div>
					</div>
					{#if imageUploadError}
						<p class="mt-2 text-sm text-red-600 dark:text-red-400">{imageUploadError}</p>
					{/if}
					{#if uploadingImage}
						<p class="mt-2 text-sm text-blue-600 dark:text-blue-400">Uploading image...</p>
					{/if}
					{#if pendingImageAction && !uploadingImage && !imageUploadError}
						<p class="mt-2 text-xs text-yellow-600 dark:text-yellow-400">Pending: Click "Update" to save changes</p>
					{/if}
				</div>

				<div>
					<label for="edit-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Name
					</label>
					<input
						type="text"
						id="edit-name"
						bind:value={newPersonName}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						placeholder="Enter person name"
					/>
				</div>

				<div>
					<p class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Role
					</p>
					<p class="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 capitalize">
						{editingPerson.role}
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Role cannot be changed after creation</p>
				</div>

				{#if editingPerson.role === 'artist'}
					<div>
						<label for="edit-style" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Style (Optional)
						</label>
						<select
							id="edit-style"
							bind:value={newPersonStyle}
							class="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="">Not specified</option>
							<option value="2d_animator">2D Animator</option>
							<option value="3d_animator">3D Animator</option>
							<option value="illustrator">Illustrator</option>
							<option value="photographer">Photographer</option>
							<option value="other">Other</option>
						</select>
					</div>
				{:else if editingPerson.role === 'performer'}
					<div>
						<label for="edit-age" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Age (Optional)
						</label>
						<input
							type="number"
							id="edit-age"
							bind:value={newPersonAge}
							min="0"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Enter age"
						/>
					</div>
				{/if}
				
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => isGlobal = !isGlobal}
						aria-label="Toggle global person"
						class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {isGlobal ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}"
					>
						<span class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform {isGlobal ? 'translate-x-5' : 'translate-x-1'}"></span>
					</button>
					<span class="text-sm text-gray-700 dark:text-gray-300">
						Global
					</span>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					type="button"
					onclick={cancelEdit}
					class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={() => updatePerson()}
					disabled={loading}
					class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
				>
					{loading ? 'Updating...' : 'Update'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showCrossLibraryWarning}
	<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
			<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Person Credited in Other Libraries</h3>
			
			<div class="space-y-4">
				<p class="text-sm text-gray-700 dark:text-gray-300">
					This person is currently credited in <strong>{totalAffectedItems}</strong> item{totalAffectedItems !== 1 ? 's' : ''} in the following {crossLibraryUsage.length === 1 ? 'library' : 'libraries'}:
				</p>
				
				<ul class="space-y-2">
					{#each crossLibraryUsage as lib}
						<li class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
							<span class="w-2 h-2 bg-blue-500 rounded-full"></span>
							<strong>{lib.library_name}</strong> ({lib.count} item{lib.count !== 1 ? 's' : ''})
						</li>
					{/each}
				</ul>
				
				<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
					<p class="text-sm text-amber-800 dark:text-amber-200">
						Converting this person to library-specific will remove their credits from all items in other libraries. This action cannot be undone.
					</p>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					type="button"
					onclick={cancelForceUpdate}
					class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={confirmForceUpdate}
					class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
				>
					Remove & Convert
				</button>
			</div>
		</div>
	</div>
{/if}
