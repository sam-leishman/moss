<script lang="ts">
	import type { Media, Person } from '$lib/server/db';
	import { basename } from '$lib/utils/path';
	import { formatBytes, formatDateTime, formatDuration, formatBitrate } from '$lib/utils/format';
	import TagSelector from './TagSelector.svelte';
	import CreditSelector from './CreditSelector.svelte';
	import TitleEditor from './TitleEditor.svelte';
	import { X, Info, Pencil, ChevronLeft, ChevronRight, Heart } from 'lucide-svelte';
	import VideoPlayer from './VideoPlayer.svelte';
	import { likesStore } from '$lib/stores/likes.svelte';

	interface Props {
		media: Media | null;
		onClose: () => void;
		currentIndex?: number;
		totalItems?: number;
		onNext?: () => void;
		onPrevious?: () => void;
		onMediaUpdate?: (updatedMedia: Media) => void;
	}

	let { media, onClose, currentIndex, totalItems, onNext, onPrevious, onMediaUpdate }: Props = $props();
	let showInfo = $state(false);
	let showEdit = $state(false);
	let credits = $state<Person[]>([]);
	let mediaData = $state<Media | null>(media);
	let creditsAbortController: AbortController | null = null;
	let mediaDataAbortController: AbortController | null = null;
	let isLiking = $state(false);
	let selectedQuality = $state<string>('original');
	let availableQualities = $state<string[]>([]);
	let qualitiesAbortController: AbortController | null = null;
	let videoElement = $state<HTMLVideoElement | null>(null);
	let isSeekable = $state(true);
	let cacheCheckInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		mediaData = media;
		selectedQuality = 'original';
		availableQualities = [];
		if (creditsAbortController) {
			creditsAbortController.abort();
			creditsAbortController = null;
		}
		if (mediaDataAbortController) {
			mediaDataAbortController.abort();
			mediaDataAbortController = null;
		}
		if (qualitiesAbortController) {
			qualitiesAbortController.abort();
			qualitiesAbortController = null;
		}
		if (cacheCheckInterval) {
			clearInterval(cacheCheckInterval);
			cacheCheckInterval = null;
		}
		isSeekable = true;
		if (media?.media_type === 'video') {
			loadQualities();
		}
		
		return () => {
			if (creditsAbortController) {
				creditsAbortController.abort();
				creditsAbortController = null;
			}
			if (mediaDataAbortController) {
				mediaDataAbortController.abort();
				mediaDataAbortController = null;
			}
			if (qualitiesAbortController) {
				qualitiesAbortController.abort();
				qualitiesAbortController = null;
			}
			if (cacheCheckInterval) {
				clearInterval(cacheCheckInterval);
				cacheCheckInterval = null;
			}
		};
	});

	const handleBackdropClick = () => {
		if (showInfo) {
			showInfo = false;
		}
		if (showEdit) {
			showEdit = false;
		}
	};

	const handlePanelClick = (e: MouseEvent) => {
		e.stopPropagation();
	};

	const withStopPropagation = (fn: () => void) => (e: MouseEvent) => {
		e.stopPropagation();
		fn();
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			if (showInfo || showEdit) {
				showInfo = false;
				showEdit = false;
			} else {
				onClose();
			}
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			if (onPrevious && hasPrevious) {
				onPrevious();
			}
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			if (onNext && hasNext) {
				onNext();
			}
		}
	};

	const toggleInfo = async () => {
		if (showEdit) showEdit = false;
		showInfo = !showInfo;
		if (showInfo && media) {
			await loadCredits();
		}
	};

	const loadCredits = async () => {
		if (!media) return;
		
		if (creditsAbortController) {
			creditsAbortController.abort();
		}
		
		creditsAbortController = new AbortController();
		const currentMediaId = media.id;
		
		try {
			const response = await fetch(`/api/media/${currentMediaId}/credits`, {
				signal: creditsAbortController.signal
			});
			
			if (!response.ok) {
				console.error(`Failed to load credits: ${response.status}`);
				return;
			}
			
			if (media?.id === currentMediaId) {
				credits = await response.json();
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			console.error('Failed to load credits', err);
		} finally {
			creditsAbortController = null;
		}
	};

	const refreshMediaData = async () => {
		if (!media) return;
		
		if (mediaDataAbortController) {
			mediaDataAbortController.abort();
		}
		
		mediaDataAbortController = new AbortController();
		const currentMediaId = media.id;
		
		try {
			const response = await fetch(`/api/media/${currentMediaId}`, {
				signal: mediaDataAbortController.signal
			});
			
			if (!response.ok) {
				console.error(`Failed to refresh media data: ${response.status}`);
				return;
			}
			
			if (media?.id === currentMediaId) {
				const updated = await response.json();
				mediaData = updated;
				onMediaUpdate?.(updated);
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			console.error('Failed to refresh media data', err);
		} finally {
			mediaDataAbortController = null;
		}
	};

	const toggleEdit = () => {
		if (showInfo) showInfo = false;
		showEdit = !showEdit;
	};

	const handleLikeClick = async () => {
		if (!media || isLiking) return;
		
		isLiking = true;
		try {
			await likesStore.toggleLike(media.id);
		} catch (error) {
			console.error('Failed to toggle like:', error);
		} finally {
			isLiking = false;
		}
	};

	const hasPrevious = $derived(currentIndex !== undefined && currentIndex > 0);
	const hasNext = $derived(currentIndex !== undefined && totalItems !== undefined && currentIndex < totalItems - 1);
	const isLiked = $derived(media ? likesStore.isLiked(media.id) : false);
	const videoSrc = $derived(
		media
			? `/api/media/${media.id}/file${selectedQuality !== 'original' ? `?quality=${selectedQuality}` : ''}`
			: ''
	);

	const loadQualities = async () => {
		if (!media) return;

		if (qualitiesAbortController) {
			qualitiesAbortController.abort();
		}

		qualitiesAbortController = new AbortController();
		const currentMediaId = media.id;

		try {
			const response = await fetch(`/api/media/${currentMediaId}/qualities`, {
				signal: qualitiesAbortController.signal
			});

			if (!response.ok) return;

			if (media?.id === currentMediaId) {
				const data = await response.json();
				availableQualities = data.qualities;
				// If 'original' isn't available (incompatible codec), select the
				// highest transcode quality. Otherwise keep 'original'.
				if (!data.qualities.includes('original') && data.qualities.length > 0) {
					selectedQuality = data.qualities[0];
				}
				updateSeekable(data.cached);
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return;
			console.error('Failed to load qualities', err);
		} finally {
			qualitiesAbortController = null;
		}
	};

	const updateSeekable = (cached: Record<string, boolean> | undefined) => {
		if (!cached) {
			isSeekable = true;
			return;
		}

		isSeekable = cached[selectedQuality] ?? true;

		// If not seekable, poll the qualities endpoint until cache is ready
		if (!isSeekable && !cacheCheckInterval && media) {
			const mediaId = media.id;
			cacheCheckInterval = setInterval(async () => {
				try {
					const res = await fetch(`/api/media/${mediaId}/qualities`);
					if (!res.ok) return;
					const data = await res.json();
					const nowCached = data.cached?.[selectedQuality] ?? true;
					if (nowCached) {
						isSeekable = true;
						if (cacheCheckInterval) {
							clearInterval(cacheCheckInterval);
							cacheCheckInterval = null;
						}
						// Reload the video source so the browser fetches from
						// the cached file which supports Range requests (seeking).
						if (videoElement) {
							const wasPlaying = !videoElement.paused;
							const savedTime = videoElement.currentTime;
							videoElement.src = videoSrc;
							videoElement.currentTime = savedTime;
							if (wasPlaying) {
								videoElement.play().catch(() => {});
							}
						}
					}
				} catch { /* ignore polling errors */ }
			}, 5000);
		}
	};

	const handleQualityChange = (quality: string) => {
		// Explicitly stop the current video load before switching quality.
		// This forces the browser to abort the in-flight HTTP request,
		// which triggers the server-side abort signal to kill ffmpeg.
		if (videoElement) {
			videoElement.pause();
			videoElement.removeAttribute('src');
			videoElement.load();
		}
		selectedQuality = quality;
		// Re-check seekable state — will be updated on next qualities poll
		isSeekable = true;
		if (cacheCheckInterval) {
			clearInterval(cacheCheckInterval);
			cacheCheckInterval = null;
		}
		loadQualities();
	};

</script>

<svelte:window onkeydown={handleKeydown} />

{#if media}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/95"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-label="Media viewer"
		tabindex="-1"
	>
		<div class="relative w-full h-full flex items-center justify-center p-8 group">
			{#if media.media_type === 'image' || media.media_type === 'animated'}
				<img
					src="/api/media/{media.id}/file"
					alt={media.title || basename(media.path)}
					class="max-w-full max-h-full object-contain"
				/>
			{:else if media.media_type === 'video'}
				<VideoPlayer
					src={videoSrc}
					duration={media.duration}
					bind:videoElement
					{availableQualities}
					{selectedQuality}
					onQualityChange={handleQualityChange}
					{isSeekable}
				/>
			{/if}

			<button
				type="button"
				onclick={withStopPropagation(onClose)}
				class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
				aria-label="Close"
			>
				<X class="w-6 h-6" />
			</button>

			<button
				type="button"
				onclick={withStopPropagation(toggleInfo)}
				class="absolute top-4 right-16 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
				aria-label="Toggle info"
			>
				<Info class="w-6 h-6" />
			</button>

			<button
				type="button"
				onclick={withStopPropagation(handleLikeClick)}
				class="absolute top-4 right-28 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors disabled:opacity-50"
				aria-label={isLiked ? 'Unlike' : 'Like'}
				disabled={isLiking}
			>
				<Heart class="w-6 h-6 transition-colors {isLiked ? 'fill-red-500 text-red-500' : ''}" />
			</button>

			<button
				type="button"
				onclick={withStopPropagation(toggleEdit)}
				class="absolute top-4 right-40 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
				aria-label="Toggle edit"
			>
				<Pencil class="w-6 h-6" />
			</button>

			{#if hasPrevious}
				<button
					type="button"
					onclick={withStopPropagation(() => onPrevious?.())}
					class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-all opacity-0 group-hover:opacity-100"
					aria-label="Previous"
				>
					<ChevronLeft class="w-8 h-8" />
				</button>
			{/if}

			{#if hasNext}
				<button
					type="button"
					onclick={withStopPropagation(() => onNext?.())}
					class="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-all opacity-0 group-hover:opacity-100"
					aria-label="Next"
				>
					<ChevronRight class="w-8 h-8" />
				</button>
			{/if}

			{#if currentIndex !== undefined && totalItems !== undefined}
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
					{currentIndex + 1} / {totalItems}
				</div>
			{/if}
		</div>

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out {showInfo ? 'translate-x-0' : 'translate-x-full'}"
			onclick={handlePanelClick}
		>
			<div class="h-full flex flex-col">
				<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Information</h3>
					<button
						type="button"
						onclick={withStopPropagation(toggleInfo)}
						class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
						aria-label="Close info panel"
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-4 space-y-4">
					{#if mediaData?.title}
						<div>
							<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Title</h4>
							<p class="text-gray-900 dark:text-white">{mediaData.title}</p>
						</div>
					{/if}

					<div>
						<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Filename</h4>
						<p class="text-gray-900 dark:text-white text-sm">{basename(media.path)}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Type</h4>
						<p class="text-gray-900 dark:text-white capitalize">{media.media_type}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">File Size</h4>
						<p class="text-gray-900 dark:text-white">{formatBytes(media.size)}</p>
					</div>

					{#if media.duration !== null && media.duration !== undefined}
						<div>
							<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Duration</h4>
							<p class="text-gray-900 dark:text-white">{formatDuration(media.duration)}</p>
						</div>
					{/if}

					{#if media.width && media.height}
						<div>
							<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Resolution</h4>
							<p class="text-gray-900 dark:text-white">{media.width} × {media.height}</p>
						</div>
					{/if}

					{#if media.video_codec}
						<div>
							<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Codec</h4>
							<p class="text-gray-900 dark:text-white uppercase">{media.video_codec}{#if media.audio_codec} / {media.audio_codec}{/if}</p>
						</div>
					{/if}

					{#if media.bitrate}
						<div>
							<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Bitrate</h4>
							<p class="text-gray-900 dark:text-white">{formatBitrate(media.bitrate)}</p>
						</div>
					{/if}

					<div>
						<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Created</h4>
						<p class="text-gray-900 dark:text-white text-sm">{formatDateTime(media.birthtime)}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Added to Library</h4>
						<p class="text-gray-900 dark:text-white text-sm">{formatDateTime(media.created_at)}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">File Path</h4>
						<p class="text-gray-700 dark:text-gray-300 text-xs break-all font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">{media.path}</p>
					</div>

					{#if credits.length > 0}
						<div>
							<h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Credits</h4>
							<div class="space-y-2">
								{#each credits as person (person.id)}
									<a
										href="/libraries/{media.library_id}/people/{person.id}"
										class="block p-2 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
										onclick={(e) => e.stopPropagation()}
									>
										<p class="text-sm font-medium text-gray-900 dark:text-white">{person.name}</p>
										<p class="text-xs text-gray-500 dark:text-gray-400 capitalize">{person.role}</p>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Edit Panel -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out {showEdit ? 'translate-x-0' : 'translate-x-full'}"
			onclick={handlePanelClick}
		>
			<div class="h-full flex flex-col">
				<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Edit</h3>
					<button
						type="button"
						onclick={withStopPropagation(toggleEdit)}
						class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
						aria-label="Close edit panel"
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-4 space-y-6">
					<TitleEditor 
						mediaId={media.id} 
						currentTitle={mediaData?.title || null} 
						filePath={media.path}
						onUpdate={refreshMediaData}
					/>
					<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
						<TagSelector mediaId={media.id} libraryId={media.library_id} />
					</div>
					<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
						<CreditSelector mediaId={media.id} libraryId={media.library_id} />
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
