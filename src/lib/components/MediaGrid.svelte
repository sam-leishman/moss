<script lang="ts">
	import type { Media } from '$lib/server/db';
	import MediaCard from './MediaCard.svelte';

	interface Props {
		items: Media[];
		onItemClick?: (media: Media) => void;
		onItemContextMenu?: (media: Media, e: MouseEvent) => void;
	}

	let { items, onItemClick, onItemContextMenu }: Props = $props();
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
	{#each items as media (media.id)}
		<MediaCard {media} onClick={onItemClick} onContextMenu={onItemContextMenu} />
	{/each}
</div>

{#if items.length === 0}
	<div class="text-center py-12 text-gray-500">
		<p>No media found</p>
	</div>
{/if}
