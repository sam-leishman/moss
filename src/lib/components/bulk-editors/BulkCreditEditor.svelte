<script lang="ts">
	import { User, Check, Circle, Search } from 'lucide-svelte';

	interface PersonWithState {
		id: number;
		name: string;
		role: string;
		appliedCount: number;
		totalCount: number;
		state: 'all' | 'some' | 'none';
	}

	interface Props {
		people: PersonWithState[];
		onApply: (operation: 'add' | 'remove', personIds: number[]) => Promise<void>;
	}

	let { people, onApply }: Props = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let searchInputRef = $state<HTMLInputElement | null>(null);

	const filteredPeople = $derived(
		searchQuery.trim()
			? people.filter(person => person.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
			: people
	);

	export const focusSearch = () => {
		queueMicrotask(() => searchInputRef?.focus());
	};

	const handlePersonClick = async (person: PersonWithState) => {
		loading = true;
		error = null;

		try {
			if (person.state === 'all') {
				await onApply('remove', [person.id]);
			} else {
				await onApply('add', [person.id]);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Operation failed';
		} finally {
			loading = false;
		}
	};

	const getPersonButtonClass = (person: PersonWithState) => {
		if (person.state === 'all') {
			return 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30';
		}
		if (person.state === 'some') {
			return 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10 text-green-600/70 dark:text-green-400/70 hover:bg-green-100/70 dark:hover:bg-green-900/20';
		}
		return 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';
	};

	const getPersonIcon = (person: PersonWithState) => {
		return person.state;
	};

	const getPersonTitle = (person: PersonWithState) => {
		if (person.state === 'all') {
			return `Credited on all items - Click to remove`;
		}
		if (person.state === 'some') {
			return `Credited on ${person.appliedCount} of ${person.totalCount} items - Click to add to all`;
		}
		return 'Not credited - Click to add';
	};
</script>

<div class="p-4 space-y-4">
	<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
		<p class="text-sm text-blue-800 dark:text-blue-200">
			Click people to credit them on all selected items. Click again to remove from all items.
		</p>
	</div>

	{#if error}
		<div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
			{error}
		</div>
	{/if}

	<div>
		<div class="relative mb-3">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
			<input
				type="text"
				bind:value={searchQuery}
				bind:this={searchInputRef}
				placeholder="Search people..."
				class="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
		</div>

		<div class="flex items-center justify-between mb-3">
			<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">People</h4>
			<div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
				<div class="flex items-center gap-1">
					<span class="w-3 h-3 rounded border-2 border-green-500 bg-green-50"></span>
					<span>All</span>
				</div>
				<div class="flex items-center gap-1">
					<span class="w-3 h-3 rounded border-2 border-green-300 bg-green-50/50"></span>
					<span>Some</span>
				</div>
			</div>
		</div>
		{#if people.length === 0}
			<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No people available. Create people first.</p>
		{:else if filteredPeople.length === 0}
			<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No people matching "{searchQuery.trim()}"</p>
		{:else}
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
				{#each filteredPeople as person (person.id)}
					<button
						type="button"
						onclick={() => handlePersonClick(person)}
						disabled={loading}
						class="flex flex-col items-start gap-1 px-3 py-2 text-sm rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed {getPersonButtonClass(person)}"
						title={getPersonTitle(person)}
					>
						<div class="flex items-center gap-2 w-full">
							{#if person.state === 'all'}
								<Check class="w-3 h-3" />
							{:else if person.state === 'some'}
								<Circle class="w-3 h-3 fill-current opacity-50" />
							{:else}
								<User class="w-3 h-3" />
							{/if}
							<span class="flex-1 text-left truncate font-medium">{person.name}</span>
							{#if person.state === 'some'}
								<span class="text-xs opacity-60">{person.appliedCount}/{person.totalCount}</span>
							{/if}
						</div>
						<span class="text-xs opacity-60 capitalize ml-5">{person.role}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
