<script lang="ts">
	import { Plus, X } from 'lucide-svelte';
	import type { Person } from '$lib/server/db';

	interface Props {
		mediaId: number;
		libraryId: number;
	}

	let { mediaId, libraryId }: Props = $props();

	let credits = $state<Person[]>([]);
	let allPeople = $state<Person[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let selectedPersonId = $state<number | null>(null);
	let previousLibraryId = $state<number | null>(null);
	let previousMediaId = $state<number | null>(null);

	const loadCredits = async () => {
		try {
			const response = await fetch(`/api/media/${mediaId}/credits`);
			if (!response.ok) throw new Error('Failed to fetch credits');
			credits = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load credits';
		}
	};

	const loadPeople = async () => {
		try {
			const response = await fetch(`/api/people?library_id=${libraryId}`);
			if (!response.ok) throw new Error('Failed to fetch people');
			allPeople = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load people';
		}
	};

	const addCredit = async () => {
		if (!selectedPersonId) return;

		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/media/${mediaId}/credits`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ person_id: selectedPersonId })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to add credit');
			}

			selectedPersonId = null;
			await loadCredits();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add credit';
		} finally {
			loading = false;
		}
	};

	const removeCredit = async (personId: number) => {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/media/${mediaId}/credits?person_id=${personId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to remove credit');
			}

			await loadCredits();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove credit';
		} finally {
			loading = false;
		}
	};

	const availablePeople = $derived(
		allPeople.filter(person => !credits.some(credit => credit.id === person.id))
	);

	$effect(() => {
		// Reload when library or media changes
		if (libraryId !== previousLibraryId || mediaId !== previousMediaId) {
			previousLibraryId = libraryId;
			previousMediaId = mediaId;
			loadCredits();
			loadPeople();
		}
	});
</script>

<div class="space-y-4">
	<div>
		<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Credits</h4>
		
		{#if error}
			<div class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-200 text-sm mb-2">
				{error}
			</div>
		{/if}

		{#if credits.length > 0}
			<div class="space-y-2 mb-3">
				{#each credits as person (person.id)}
					<div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
						<div>
							<p class="text-sm font-medium text-gray-900 dark:text-white">{person.name}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 capitalize">{person.role}</p>
						</div>
						<button
							type="button"
							onclick={() => removeCredit(person.id)}
							disabled={loading}
							class="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
							aria-label="Remove credit"
						>
							<X class="w-4 h-4" />
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No credits assigned</p>
		{/if}

		<div class="flex gap-2">
			<select
				bind:value={selectedPersonId}
				class="flex-1 pl-3 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			>
				<option value={null}>Select person...</option>
				{#each availablePeople as person (person.id)}
					<option value={person.id}>{person.name} ({person.role})</option>
				{/each}
			</select>
			<button
				type="button"
				onclick={addCredit}
				disabled={loading || !selectedPersonId}
				class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				aria-label="Add credit"
			>
				<Plus class="w-4 h-4" />
			</button>
		</div>
	</div>
</div>
