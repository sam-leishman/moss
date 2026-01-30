<script lang="ts">
	import type { Media } from '$lib/server/db';
	import { basename } from '$lib/utils/path';

	interface Props {
		items: Media[];
		onItemClick?: (media: Media) => void;
	}

	let { items, onItemClick }: Props = $props();

	const handleClick = (media: Media) => {
		if (onItemClick) {
			onItemClick(media);
		}
	};

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	};

	const formatDate = (dateString: string): string => {
		return new Date(dateString).toLocaleDateString();
	};

	const getMediaIcon = (type: string) => {
		switch (type) {
			case 'video':
				return '🎬';
			case 'animated':
				return '🎞️';
			default:
				return '🖼️';
		}
	};
</script>

<div class="divide-y divide-gray-200">
	{#each items as media (media.id)}
		<button
			class="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer text-left"
			onclick={() => handleClick(media)}
			type="button"
		>
			<div class="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
				<img
					src="/api/media/{media.id}/thumbnail"
					alt={media.title || basename(media.path)}
					class="w-full h-full object-cover"
					loading="lazy"
				/>
			</div>

			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<span class="text-lg">{getMediaIcon(media.media_type)}</span>
					<h3 class="text-sm font-medium text-gray-900 truncate">
						{media.title || basename(media.path)}
					</h3>
				</div>
				<p class="text-sm text-gray-500 truncate mt-1">{media.path}</p>
				<div class="flex gap-4 mt-1 text-xs text-gray-400">
					<span>{media.media_type}</span>
					<span>{formatBytes(media.size)}</span>
					<span>{formatDate(media.birthtime)}</span>
				</div>
			</div>
		</button>
	{/each}
</div>

{#if items.length === 0}
	<div class="text-center py-12 text-gray-500">
		<p>No media found</p>
	</div>
{/if}
