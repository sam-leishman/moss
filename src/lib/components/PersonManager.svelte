<script lang="ts">
	import { Plus, Trash2, Pencil, User } from 'lucide-svelte';
	import type { Person } from '$lib/server/db';

	let people = $state<Person[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let showCreateModal = $state(false);
	let editingPerson = $state<Person | null>(null);

	let newPersonName = $state('');
	let newPersonRole = $state<'artist' | 'performer'>('artist');
	let newPersonStyle = $state<string>('');
	let newPersonAge = $state<number | null>(null);

	const loadPeople = async () => {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/people');
			if (!response.ok) throw new Error('Failed to fetch people');
			people = await response.json();
		} catch (err) {
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
					profile
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create person');
			}

			newPersonName = '';
			newPersonStyle = '';
			newPersonAge = null;
			showCreateModal = false;
			await loadPeople();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create person';
		} finally {
			loading = false;
		}
	};

	const updatePerson = async () => {
		if (!editingPerson) return;

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
					profile
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to update person');
			}

			editingPerson = null;
			newPersonName = '';
			newPersonStyle = '';
			newPersonAge = null;
			await loadPeople();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update person';
		} finally {
			loading = false;
		}
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
		editingPerson = null;
		newPersonName = '';
		newPersonStyle = '';
		newPersonAge = null;
	};

	const openCreateModal = () => {
		newPersonName = '';
		newPersonRole = 'artist';
		newPersonStyle = '';
		newPersonAge = null;
		showCreateModal = true;
	};

	$effect(() => {
		loadPeople();
	});
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold text-gray-900 dark:text-white">People</h2>
		<button
			type="button"
			onclick={openCreateModal}
			class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
		>
			<Plus class="w-4 h-4" />
			Add Person
		</button>
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
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each people as person (person.id)}
				<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-3 flex-1">
							<div class="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
								<User class="w-5 h-5 text-gray-600 dark:text-gray-400" />
							</div>
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-gray-900 dark:text-white truncate">{person.name}</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 capitalize">{person.role}</p>
							</div>
						</div>
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
	{/if}
</div>

{#if showCreateModal}
	<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
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
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
			<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Person</h3>
			
			<div class="space-y-4">
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
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
					onclick={updatePerson}
					disabled={loading}
					class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
				>
					{loading ? 'Updating...' : 'Update'}
				</button>
			</div>
		</div>
	</div>
{/if}
