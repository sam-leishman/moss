<script lang="ts">
	import type { Media } from '$lib/server/db';
	import { basename } from '$lib/utils/path';
	import { Film, Clapperboard, Image, Heart } from 'lucide-svelte';
	import { likesStore } from '$lib/stores/likes.svelte';

	interface Props {
		media: Media;
		onClick?: (media: Media) => void;
	}

	let { media, onClick }: Props = $props();

	let isLiking = $state(false);

	const handleClick = () => {
		if (onClick) {
			onClick(media);
		}
	};

	const handleLikeClick = async (e: MouseEvent) => {
		e.stopPropagation();
		
		if (isLiking) return;
		
		isLiking = true;
		try {
			await likesStore.toggleLike(media.id);
		} catch (error) {
			console.error('Failed to toggle like:', error);
		} finally {
			isLiking = false;
		}
	};

	const IconComponent = $derived.by(() => {
		switch (media.media_type) {
			case 'video':
				return Film;
			case 'animated':
				return Clapperboard;
			default:
				return Image;
		}
	});

	const isLiked = $derived(likesStore.isLiked(media.id));
	const displayTitle = $derived(media.title || basename(media.path));
</script>

<div
	class="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
	onclick={handleClick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
	<img
		src="/api/media/{media.id}/thumbnail"
		alt={displayTitle}
		class="w-full h-full object-cover"
		loading="lazy"
	/>
	
	<button
		type="button"
		onclick={handleLikeClick}
		class="absolute top-2 left-2 p-1.5 rounded-full bg-black/20 backdrop-blur-sm transition-all {isLiked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} hover:bg-black/40 disabled:opacity-50"
		disabled={isLiking}
		aria-label={isLiked ? 'Unlike' : 'Like'}
	>
		<Heart 
			class="w-5 h-5 transition-colors {isLiked ? 'fill-red-500 text-red-500' : 'text-white'}" 
		/>
	</button>
	
	<div class="absolute top-2 right-2 opacity-80">
		<IconComponent class="w-6 h-6 text-white drop-shadow-lg" />
	</div>

	<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
		<p class="text-white text-sm font-medium truncate">{displayTitle}</p>
		<p class="text-white/70 text-xs">{media.media_type}</p>
	</div>
</div>
