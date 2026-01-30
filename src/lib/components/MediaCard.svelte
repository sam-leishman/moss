<script lang="ts">
	import type { Media } from '$lib/server/db';
	import { basename } from '$lib/utils/path';

	interface Props {
		media: Media;
		onClick?: (media: Media) => void;
	}

	let { media, onClick }: Props = $props();

	const handleClick = () => {
		if (onClick) {
			onClick(media);
		}
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

	const displayTitle = $derived(media.title || basename(media.path));
</script>

<button
	class="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
	onclick={handleClick}
	type="button"
>
	<img
		src="/api/media/{media.id}/thumbnail"
		alt={displayTitle}
		class="w-full h-full object-cover"
		loading="lazy"
	/>
	
	<div class="absolute top-2 right-2 text-2xl opacity-80">
		{getMediaIcon(media.media_type)}
	</div>

	<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
		<p class="text-white text-sm font-medium truncate">{displayTitle}</p>
		<p class="text-white/70 text-xs">{media.media_type}</p>
	</div>
</button>
