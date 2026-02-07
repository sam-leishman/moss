<script lang="ts">
	import { Pencil } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		x: number;
		y: number;
		onEdit: () => void;
		onClose: () => void;
	}

	let { x, y, onEdit, onClose }: Props = $props();

	let menuRef = $state<HTMLDivElement | null>(null);
	let adjustedX = $state(0);
	let adjustedY = $state(0);

	$effect(() => {
		adjustedX = x;
		adjustedY = y;
	});

	onMount(() => {
		if (menuRef) {
			const rect = menuRef.getBoundingClientRect();
			if (rect.right > window.innerWidth) {
				adjustedX = window.innerWidth - rect.width - 8;
			}
			if (rect.bottom > window.innerHeight) {
				adjustedY = window.innerHeight - rect.height - 8;
			}
		}
	});

	const handleEdit = () => {
		onEdit();
		onClose();
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50"
	onclick={onClose}
	oncontextmenu={(e) => { e.preventDefault(); onClose(); }}
>
	<div
		bind:this={menuRef}
		class="absolute bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px] z-50"
		style="left: {adjustedX}px; top: {adjustedY}px;"
		onclick={(e) => e.stopPropagation()}
	>
		<button
			type="button"
			onclick={handleEdit}
			class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
		>
			<Pencil class="w-4 h-4 text-gray-400 dark:text-gray-500" />
			Edit
		</button>
	</div>
</div>
