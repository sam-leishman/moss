<script lang="ts">
	import { formatDuration } from '$lib/utils/format';
	import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings } from 'lucide-svelte';

	interface Props {
		src: string;
		duration: number | null;
		videoElement?: HTMLVideoElement | null;
		availableQualities?: string[];
		selectedQuality?: string;
		onQualityChange?: (quality: string) => void;
		useHlsPlayback?: boolean;
	}

	let {
		src,
		duration: knownDuration,
		videoElement = $bindable(null),
		availableQualities = [],
		selectedQuality = 'original',
		onQualityChange,
		useHlsPlayback = false
	}: Props = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let seekBarEl = $state<HTMLDivElement | null>(null);
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let bufferedEnd = $state(0);
	let volume = $state(1);
	let previousVolume = $state(1);
	let isMuted = $state(false);
	let isFullscreen = $state(false);
	let showControls = $state(true);
	let showQualityMenu = $state(false);
	let isSeeking = $state(false);
	let controlsTimeout: ReturnType<typeof setTimeout> | null = null;

	const qualityLabels: Record<string, string> = {
		original: 'Original',
		high: '1080p',
		medium: '720p',
		low: '480p'
	};

	// Use known duration from DB, fall back to video element duration
	const displayDuration = $derived(
		knownDuration && isFinite(knownDuration) ? knownDuration : (videoElement?.duration || 0)
	);

	const progress = $derived(
		displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0
	);

	const bufferedProgress = $derived(
		displayDuration > 0 ? (bufferedEnd / displayDuration) * 100 : 0
	);

	function togglePlay() {
		if (!videoElement) return;
		if (videoElement.paused) {
			videoElement.play().catch(() => {});
		} else {
			videoElement.pause();
		}
	}

	function handleTimeUpdate() {
		if (!videoElement || isSeeking) return;
		currentTime = videoElement.currentTime;
		updateBuffered();
	}

	function updateBuffered() {
		if (!videoElement || videoElement.buffered.length === 0) return;
		bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
	}

	function handlePlay() {
		isPlaying = true;
	}

	function handlePause() {
		isPlaying = false;
	}

	function seekToFraction(clientX: number) {
		if (!videoElement || !seekBarEl) return;
		const rect = seekBarEl.getBoundingClientRect();
		const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const newTime = fraction * displayDuration;
		currentTime = newTime;
		videoElement.currentTime = newTime;
	}

	function handleSeekStart(e: MouseEvent) {
		isSeeking = true;
		seekToFraction(e.clientX);

		const onMove = (ev: MouseEvent) => seekToFraction(ev.clientX);
		const onUp = () => {
			isSeeking = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	function toggleMute() {
		if (!videoElement) return;
		if (isMuted) {
			volume = previousVolume || 0.5;
			videoElement.volume = volume;
			videoElement.muted = false;
			isMuted = false;
		} else {
			previousVolume = volume;
			videoElement.muted = true;
			isMuted = true;
		}
	}

	function handleVolumeChange(e: Event) {
		if (!videoElement) return;
		const input = e.target as HTMLInputElement;
		volume = parseFloat(input.value);
		videoElement.volume = volume;
		videoElement.muted = volume === 0;
		isMuted = volume === 0;
	}

	function toggleFullscreen() {
		if (!containerEl) return;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			containerEl.requestFullscreen().catch(() => {});
		}
	}

	function handleFullscreenChange() {
		isFullscreen = !!document.fullscreenElement;
	}

	function handleQualitySelect(quality: string) {
		showQualityMenu = false;
		if (quality !== selectedQuality) {
			onQualityChange?.(quality);
		}
	}

	function resetControlsTimer() {
		showControls = true;
		if (controlsTimeout) clearTimeout(controlsTimeout);
		controlsTimeout = setTimeout(() => {
			if (isPlaying) showControls = false;
		}, 3000);
	}

	function handleMouseMove() {
		resetControlsTimer();
	}

	function handleMouseLeave() {
		if (isPlaying) {
			if (controlsTimeout) clearTimeout(controlsTimeout);
			controlsTimeout = setTimeout(() => {
				showControls = false;
				showQualityMenu = false;
			}, 1000);
		}
	}

	function handleContainerClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		// Don't toggle play if clicking on controls
		if (target.closest('[data-controls]')) return;
		togglePlay();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!videoElement) return;
		const target = e.target as HTMLElement;
		// Don't handle if typing in an input
		if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;

		switch (e.key) {
			case ' ':
			case 'k':
				e.preventDefault();
				togglePlay();
				break;
			case 'f':
				e.preventDefault();
				toggleFullscreen();
				break;
			case 'm':
				e.preventDefault();
				toggleMute();
				break;
			case 'ArrowRight':
				e.preventDefault();
				e.stopPropagation();
				videoElement.currentTime = Math.min(videoElement.currentTime + 10, displayDuration);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				e.stopPropagation();
				videoElement.currentTime = Math.max(videoElement.currentTime - 10, 0);
				break;
			case 'ArrowUp':
				e.preventDefault();
				e.stopPropagation();
				volume = Math.min(1, volume + 0.1);
				videoElement.volume = volume;
				break;
			case 'ArrowDown':
				e.preventDefault();
				e.stopPropagation();
				volume = Math.max(0, volume - 0.1);
				videoElement.volume = volume;
				break;
		}
		resetControlsTimer();
	}

	// Close quality menu when clicking outside
	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('[data-quality-menu]')) {
			showQualityMenu = false;
		}
	}
</script>

<svelte:window onfullscreenchange={handleFullscreenChange} onclick={handleWindowClick} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={containerEl}
	class="relative w-full h-full flex items-center justify-center bg-black group select-none"
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
	onclick={handleContainerClick}
	onkeydown={handleKeydown}
	role="application"
	tabindex="0"
	aria-label="Video player"
>
	<!-- Video Element -->
	<video
		bind:this={videoElement}
		src={useHlsPlayback ? undefined : src}
		class="max-w-full max-h-full"
		ontimeupdate={handleTimeUpdate}
		onplay={handlePlay}
		onpause={handlePause}
		onprogress={updateBuffered}
		preload="metadata"
	>
		<track kind="captions" />
	</video>

	<!-- Big play button overlay (when paused) -->
	{#if !isPlaying}
		<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
			<div class="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
				<Play class="w-8 h-8 text-white ml-1" />
			</div>
		</div>
	{/if}

	<!-- Controls overlay -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute bottom-0 left-0 right-0 transition-opacity duration-300 {showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
		data-controls
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Gradient background -->
		<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"></div>

		<div class="relative px-4 pb-3 pt-8">
			<!-- Seek bar -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={seekBarEl}
				class="group/seek w-full h-5 flex items-center cursor-pointer mb-2"
				onmousedown={handleSeekStart}
			>
				<div class="relative w-full h-1 group-hover/seek:h-1.5 bg-white/20 rounded-full transition-all">
					<!-- Buffered -->
					<div
						class="absolute top-0 left-0 h-full bg-white/30 rounded-full"
						style="width: {bufferedProgress}%"
					></div>
					<!-- Progress -->
					<div
						class="absolute top-0 left-0 h-full bg-white rounded-full"
						style="width: {progress}%"
					></div>
					<!-- Thumb -->
					<div
						class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/seek:opacity-100 transition-opacity shadow-md"
						style="left: {progress}%"
					></div>
				</div>
			</div>

			<!-- Bottom controls row -->
			<div class="flex items-center gap-3">
				<!-- Play/Pause -->
				<button
					type="button"
					onclick={togglePlay}
					class="text-white hover:text-white/80 transition-colors"
					aria-label={isPlaying ? 'Pause' : 'Play'}
				>
					{#if isPlaying}
						<Pause class="w-5 h-5" />
					{:else}
						<Play class="w-5 h-5" />
					{/if}
				</button>

				<!-- Volume -->
				<div class="flex items-center gap-1.5 group/vol">
					<button
						type="button"
						onclick={toggleMute}
						class="text-white hover:text-white/80 transition-colors"
						aria-label={isMuted ? 'Unmute' : 'Mute'}
					>
						{#if isMuted || volume === 0}
							<VolumeX class="w-5 h-5" />
						{:else}
							<Volume2 class="w-5 h-5" />
						{/if}
					</button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={isMuted ? 0 : volume}
						oninput={handleVolumeChange}
						class="w-0 group-hover/vol:w-20 transition-all duration-200 opacity-0 group-hover/vol:opacity-100 accent-white h-1 cursor-pointer"
						aria-label="Volume"
					/>
				</div>

				<!-- Time display -->
				<div class="text-white text-xs font-mono tabular-nums">
					{formatDuration(currentTime)} / {formatDuration(displayDuration)}
				</div>

				<div class="flex-1"></div>

				<!-- Quality selector -->
				{#if availableQualities.length > 1}
					<div class="relative" data-quality-menu>
						<button
							type="button"
							onclick={() => showQualityMenu = !showQualityMenu}
							class="text-white hover:text-white/80 transition-colors flex items-center gap-1 text-xs"
							aria-label="Quality settings"
						>
							<Settings class="w-4 h-4" />
							<span class="hidden sm:inline">{qualityLabels[selectedQuality] || selectedQuality}</span>
						</button>

						{#if showQualityMenu}
							<div class="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-sm rounded-lg border border-white/10 py-1 min-w-[120px] shadow-xl">
								{#each availableQualities as q}
									<button
										type="button"
										onclick={() => handleQualitySelect(q)}
										class="w-full text-left px-3 py-1.5 text-sm transition-colors {q === selectedQuality ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'}"
									>
										{qualityLabels[q] || q}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Fullscreen -->
				<button
					type="button"
					onclick={toggleFullscreen}
					class="text-white hover:text-white/80 transition-colors"
					aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
				>
					{#if isFullscreen}
						<Minimize class="w-5 h-5" />
					{:else}
						<Maximize class="w-5 h-5" />
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>
