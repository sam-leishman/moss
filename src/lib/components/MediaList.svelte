<script lang="ts">
	import type { Media } from '$lib/server/db';
	import { basename } from '$lib/utils/path';
	import { formatBytes, formatDate } from '$lib/utils/format';
	import { Film, Clapperboard, Image } from 'lucide-svelte';

	interface Props {
		items: Media[];
		onItemClick?: (media: Media) => void;
		onItemContextMenu?: (media: Media, e: MouseEvent) => void;
	}

	let { items, onItemClick, onItemContextMenu }: Props = $props();

	let failedThumbnails = $state(new Set<number>());

	const handleClick = (media: Media) => {
		if (onItemClick) {
			onItemClick(media);
		}
	};

</script>

<div class="divide-y divide-gray-200 dark:divide-gray-700">
	{#each items as media (media.id)}
		<button
			class="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
			onclick={() => handleClick(media)}
			oncontextmenu={(e) => { if (onItemContextMenu) { e.preventDefault(); onItemContextMenu(media, e); } }}
			type="button"
		>
			<div class="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
				{#if failedThumbnails.has(media.id)}
					<div class="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
						{#if media.media_type === 'video'}
							<Film class="w-8 h-8 text-gray-400 dark:text-gray-500" />
						{:else if media.media_type === 'animated'}
							<Clapperboard class="w-8 h-8 text-gray-400 dark:text-gray-500" />
						{:else}
							<Image class="w-8 h-8 text-gray-400 dark:text-gray-500" />
						{/if}
					</div>
				{:else}
					<img
						src="/api/media/{media.id}/thumbnail?v={media.updated_at}"
						alt={media.title || basename(media.path)}
						class="w-full h-full object-cover"
						loading="lazy"
						onerror={() => { failedThumbnails.add(media.id); failedThumbnails = failedThumbnails; }}
					/>
				{/if}
			</div>

			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					{#if media.media_type === 'video'}
						<Film class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					{:else if media.media_type === 'animated'}
						<Clapperboard class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					{:else}
						<Image class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					{/if}
					<h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">
						{media.title || basename(media.path)}
					</h3>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">{media.path}</p>
				<div class="flex gap-4 mt-1 text-xs text-gray-400 dark:text-gray-500">
					<span>{media.media_type}</span>
					<span>{formatBytes(media.size)}</span>
					<span>{formatDate(media.birthtime)}</span>
				</div>
			</div>
		</button>
	{/each}
</div>

{#if items.length === 0}
	<div class="text-center py-12 text-gray-500 dark:text-gray-400">
		<p>No media found</p>
	</div>
{/if}
