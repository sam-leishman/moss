<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { UserPlus, Edit, Trash2, Key, Shield, AlertCircle, CheckCircle, X, Eye, EyeOff } from 'lucide-svelte';

	interface User {
		id: number;
		username: string;
		role: 'admin' | 'user';
		is_active: number;
		created_at: string;
		updated_at: string;
	}

	interface Library {
		id: number;
		name: string;
	}

	let { data } = $props();
	let users = $state<User[]>(data.users || []);
	let libraries = $state<Library[]>(data.libraries || []);

	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let loading = $state(false);

	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteModal = $state(false);
	let showPasswordModal = $state(false);
	let showPermissionsModal = $state(false);

	let selectedUser = $state<User | null>(null);
	let createForm = $state({ username: '', password: '', role: 'user' as 'admin' | 'user', is_active: true });
	let editForm = $state({ username: '', role: 'user' as 'admin' | 'user', is_active: true });
	let passwordForm = $state({ newPassword: '', confirmPassword: '' });
	let permissionsForm = $state<number[]>([]);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

	onMount(async () => {
		if (!authStore.isAdmin) {
			goto('/settings/general');
		}
	});

	const loadUsers = async () => {
		try {
			const response = await fetch('/api/users');
			if (response.ok) {
				const data = await response.json();
				users = data.users;
			}
		} catch (error) {
			console.error('Failed to load users:', error);
		}
	};

	const openCreateModal = () => {
		createForm = { username: '', password: '', role: 'user', is_active: true };
		showPassword = false;
		showCreateModal = true;
		message = null;
	};

	const closeCreateModal = () => {
		showCreateModal = false;
		createForm = { username: '', password: '', role: 'user', is_active: true };
	};

	const handleCreateUser = async (e: Event) => {
		e.preventDefault();
		loading = true;
		message = null;

		try {
			const response = await fetch('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(createForm)
			});

			if (response.ok) {
				message = { type: 'success', text: 'User created successfully' };
				await loadUsers();
				closeCreateModal();
			} else {
				const error = await response.json();
				message = { type: 'error', text: error.message || 'Failed to create user' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Network error. Please try again.' };
		} finally {
			loading = false;
		}
	};

	const openEditModal = (user: User) => {
		selectedUser = user;
		editForm = { username: user.username, role: user.role, is_active: user.is_active === 1 };
		showEditModal = true;
		message = null;
	};

	const closeEditModal = () => {
		showEditModal = false;
		selectedUser = null;
	};

	const handleEditUser = async (e: Event) => {
		e.preventDefault();
		if (!selectedUser) return;

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/users/${selectedUser.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editForm)
			});

			if (response.ok) {
				message = { type: 'success', text: 'User updated successfully' };
				await loadUsers();
				closeEditModal();
			} else {
				const error = await response.json();
				message = { type: 'error', text: error.message || 'Failed to update user' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Network error. Please try again.' };
		} finally {
			loading = false;
		}
	};

	const openDeleteModal = (user: User) => {
		selectedUser = user;
		showDeleteModal = true;
		message = null;
	};

	const closeDeleteModal = () => {
		showDeleteModal = false;
		selectedUser = null;
	};

	const handleDeleteUser = async () => {
		if (!selectedUser) return;

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/users/${selectedUser.id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				message = { type: 'success', text: 'User deleted successfully' };
				await loadUsers();
				closeDeleteModal();
			} else {
				const error = await response.json();
				message = { type: 'error', text: error.message || 'Failed to delete user' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Network error. Please try again.' };
		} finally {
			loading = false;
		}
	};

	const openPasswordModal = (user: User) => {
		selectedUser = user;
		passwordForm = { newPassword: '', confirmPassword: '' };
		showPassword = false;
		showConfirmPassword = false;
		showPasswordModal = true;
		message = null;
	};

	const closePasswordModal = () => {
		showPasswordModal = false;
		selectedUser = null;
		passwordForm = { newPassword: '', confirmPassword: '' };
	};

	const handleChangePassword = async (e: Event) => {
		e.preventDefault();
		if (!selectedUser) return;

		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			message = { type: 'error', text: 'Passwords do not match' };
			return;
		}

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/users/${selectedUser.id}/password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newPassword: passwordForm.newPassword })
			});

			if (response.ok) {
				message = { type: 'success', text: 'Password changed successfully' };
				closePasswordModal();
			} else {
				const error = await response.json();
				message = { type: 'error', text: error.message || 'Failed to change password' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Network error. Please try again.' };
		} finally {
			loading = false;
		}
	};

	const openPermissionsModal = async (user: User) => {
		selectedUser = user;
		showPermissionsModal = true;
		message = null;

		try {
			const response = await fetch(`/api/users/${user.id}/permissions`);
			if (response.ok) {
				const data = await response.json();
				permissionsForm = data.libraryIds;
			}
		} catch (error) {
			console.error('Failed to load permissions:', error);
		}
	};

	const closePermissionsModal = () => {
		showPermissionsModal = false;
		selectedUser = null;
		permissionsForm = [];
	};

	const toggleLibraryPermission = (libraryId: number) => {
		if (permissionsForm.includes(libraryId)) {
			permissionsForm = permissionsForm.filter(id => id !== libraryId);
		} else {
			permissionsForm = [...permissionsForm, libraryId];
		}
	};

	const handleSavePermissions = async () => {
		if (!selectedUser) return;

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/users/${selectedUser.id}/permissions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ libraryIds: permissionsForm })
			});

			if (response.ok) {
				message = { type: 'success', text: 'Permissions updated successfully' };
				closePermissionsModal();
			} else {
				const error = await response.json();
				message = { type: 'error', text: error.message || 'Failed to update permissions' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Network error. Please try again.' };
		} finally {
			loading = false;
		}
	};

	const formatDate = (isoString: string): string => {
		const date = new Date(isoString);
		return date.toLocaleString();
	};
</script>

<div class="px-6 py-6">
	<div class="max-w-6xl">
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
				<p class="mt-2 text-gray-600 dark:text-gray-400">Manage users and their permissions</p>
			</div>
			<button
				type="button"
				onclick={openCreateModal}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
			>
				<UserPlus class="w-4 h-4" />
				Create User
			</button>
		</div>

		{#if message}
			<div class="mb-6 flex items-start gap-2 p-3 rounded-md {message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}">
				{#if message.type === 'success'}
					<CheckCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
				{:else}
					<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
				{/if}
				<p class="text-sm">{message.text}</p>
			</div>
		{/if}

		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
			{#if users.length === 0}
				<div class="p-8 text-center text-sm text-gray-600 dark:text-gray-400">
					No users found
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
							<tr>
								<th class="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Username</th>
								<th class="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Role</th>
								<th class="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
								<th class="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Created</th>
								<th class="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each users as user}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
									<td class="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
										{user.username}
										{#if user.id === authStore.user?.id}
											<span class="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										<span class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded {user.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}">
											{#if user.role === 'admin'}
												<Shield class="w-3 h-3" />
											{/if}
											{user.role}
										</span>
									</td>
									<td class="px-4 py-3">
										<span class="inline-flex px-2 py-1 text-xs font-medium rounded {user.is_active ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'}">
											{user.is_active ? 'Active' : 'Inactive'}
										</span>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-400">
										{formatDate(user.created_at)}
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center justify-end gap-2">
											<button
												type="button"
												onclick={() => openEditModal(user)}
												class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
												title="Edit user"
											>
												<Edit class="w-4 h-4" />
											</button>
											<button
												type="button"
												onclick={() => openPasswordModal(user)}
												class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
												title="Change password"
											>
												<Key class="w-4 h-4" />
											</button>
											{#if user.role === 'user'}
												<button
													type="button"
													onclick={() => openPermissionsModal(user)}
													class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
													title="Manage permissions"
												>
													<Shield class="w-4 h-4" />
												</button>
											{/if}
											{#if user.id !== authStore.user?.id}
												<button
													type="button"
													onclick={() => openDeleteModal(user)}
													class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
													title="Delete user"
												>
													<Trash2 class="w-4 h-4" />
												</button>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Create User Modal -->
{#if showCreateModal}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={closeCreateModal}
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-user-title"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="create-user-title" class="text-lg font-semibold text-gray-900 dark:text-white">Create User</h3>
				<button onclick={closeCreateModal} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<form onsubmit={handleCreateUser} class="p-6 space-y-4">
				<div>
					<label for="create-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Username
					</label>
					<input
						id="create-username"
						type="text"
						bind:value={createForm.username}
						required
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="create-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Password
					</label>
					<div class="relative">
						<input
							id="create-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={createForm.password}
							required
							class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						<button
							type="button"
							onclick={() => showPassword = !showPassword}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							{#if showPassword}
								<EyeOff class="w-4 h-4" />
							{:else}
								<Eye class="w-4 h-4" />
							{/if}
						</button>
					</div>
				</div>

				<div>
					<label for="create-role" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Role
					</label>
					<select
						id="create-role"
						bind:value={createForm.role}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<div class="flex items-center">
					<input
						id="create-active"
						type="checkbox"
						bind:checked={createForm.is_active}
						class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
					/>
					<label for="create-active" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
						Active
					</label>
				</div>

				<div class="flex justify-end gap-2 pt-4">
					<button
						type="button"
						onclick={closeCreateModal}
						class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={loading}
						class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? 'Creating...' : 'Create User'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit User Modal -->
{#if showEditModal && selectedUser}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={closeEditModal}
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-user-title"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="edit-user-title" class="text-lg font-semibold text-gray-900 dark:text-white">Edit User</h3>
				<button onclick={closeEditModal} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<form onsubmit={handleEditUser} class="p-6 space-y-4">
				<div>
					<label for="edit-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Username
					</label>
					<input
						id="edit-username"
						type="text"
						bind:value={editForm.username}
						required
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="edit-role" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Role
					</label>
					<select
						id="edit-role"
						bind:value={editForm.role}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<div class="flex items-center">
					<input
						id="edit-active"
						type="checkbox"
						bind:checked={editForm.is_active}
						class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
					/>
					<label for="edit-active" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
						Active
					</label>
				</div>

				<div class="flex justify-end gap-2 pt-4">
					<button
						type="button"
						onclick={closeEditModal}
						class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={loading}
						class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete User Modal -->
{#if showDeleteModal && selectedUser}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={closeDeleteModal}
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-user-title"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="delete-user-title" class="text-lg font-semibold text-gray-900 dark:text-white">Delete User</h3>
				<button onclick={closeDeleteModal} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<p class="text-gray-900 dark:text-white">Delete user <strong>{selectedUser.username}</strong>?</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">This action cannot be undone. All sessions and permissions for this user will be removed.</p>
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button
					type="button"
					onclick={closeDeleteModal}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleDeleteUser}
					disabled={loading}
					class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{loading ? 'Deleting...' : 'Delete User'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Change Password Modal -->
{#if showPasswordModal && selectedUser}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={closePasswordModal}
		role="dialog"
		aria-modal="true"
		aria-labelledby="password-user-title"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="password-user-title" class="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h3>
				<button onclick={closePasswordModal} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<form onsubmit={handleChangePassword} class="p-6 space-y-4">
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Changing password for <strong class="text-gray-900 dark:text-white">{selectedUser.username}</strong>
				</p>

				<div>
					<label for="new-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						New Password
					</label>
					<div class="relative">
						<input
							id="new-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={passwordForm.newPassword}
							required
							class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						<button
							type="button"
							onclick={() => showPassword = !showPassword}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							{#if showPassword}
								<EyeOff class="w-4 h-4" />
							{:else}
								<Eye class="w-4 h-4" />
							{/if}
						</button>
					</div>
				</div>

				<div>
					<label for="confirm-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Confirm Password
					</label>
					<div class="relative">
						<input
							id="confirm-password"
							type={showConfirmPassword ? 'text' : 'password'}
							bind:value={passwordForm.confirmPassword}
							required
							class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						<button
							type="button"
							onclick={() => showConfirmPassword = !showConfirmPassword}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							{#if showConfirmPassword}
								<EyeOff class="w-4 h-4" />
							{:else}
								<Eye class="w-4 h-4" />
							{/if}
						</button>
					</div>
				</div>

				<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
					<p class="text-xs text-yellow-800 dark:text-yellow-200">
						All active sessions for this user will be invalidated.
					</p>
				</div>

				<div class="flex justify-end gap-2 pt-4">
					<button
						type="button"
						onclick={closePasswordModal}
						class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={loading}
						class="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? 'Changing...' : 'Change Password'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Permissions Modal -->
{#if showPermissionsModal && selectedUser}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
		onclick={closePermissionsModal}
		role="dialog"
		aria-modal="true"
		aria-labelledby="permissions-user-title"
	>
		<div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 id="permissions-user-title" class="text-lg font-semibold text-gray-900 dark:text-white">Library Permissions</h3>
				<button onclick={closePermissionsModal} class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
					<X class="w-6 h-6" />
				</button>
			</div>
			
			<div class="p-6">
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Select which libraries <strong class="text-gray-900 dark:text-white">{selectedUser.username}</strong> can access
				</p>

				{#if libraries.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400 py-4">No libraries available</p>
				{:else}
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each libraries as library}
							<label class="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
								<input
									type="checkbox"
									checked={permissionsForm.includes(library.id)}
									onchange={() => toggleLibraryPermission(library.id)}
									class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
								/>
								<span class="text-sm text-gray-900 dark:text-white">{library.name}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<button
					type="button"
					onclick={closePermissionsModal}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleSavePermissions}
					disabled={loading}
					class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{loading ? 'Saving...' : 'Save Permissions'}
				</button>
			</div>
		</div>
	</div>
{/if}
