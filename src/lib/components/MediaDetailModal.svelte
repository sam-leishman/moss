<script lang="ts">
	import type { Media } from '$lib/server/db';
	import { basename } from '$lib/utils/path';
	import TagSelector from './TagSelector.svelte';
	import { X, Info, Pencil, ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		media: Media | null;
		onClose: () => void;
		currentIndex?: number;
		totalItems?: number;
		onNext?: () => void;
		onPrevious?: () => void;
	}

	let { media, onClose, currentIndex, totalItems, onNext, onPrevious }: Props = $props();
	let showInfo = $state(false);
	let showEdit = $state(false);

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

	const toggleInfo = () => {
		if (showEdit) showEdit = false;
		showInfo = !showInfo;
	};

	const toggleEdit = () => {
		if (showInfo) showInfo = false;
		showEdit = !showEdit;
	};

	const hasPrevious = $derived(currentIndex !== undefined && currentIndex > 0);
	const hasNext = $derived(currentIndex !== undefined && totalItems !== undefined && currentIndex < totalItems - 1);

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	};

	const formatDate = (dateString: string): string => {
		return new Date(dateString).toLocaleString();
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
				<video
					src="/api/media/{media.id}/file"
					controls
					class="max-w-full max-h-full"
				>
					<track kind="captions" />
				</video>
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
				onclick={withStopPropagation(toggleEdit)}
				class="absolute top-4 right-28 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
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
			class="absolute top-0 right-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out {showInfo ? 'translate-x-0' : 'translate-x-full'}"
			onclick={handlePanelClick}
		>
			<div class="h-full flex flex-col">
				<div class="flex items-center justify-between p-4 border-b border-gray-200">
					<h3 class="text-lg font-semibold text-gray-900">Information</h3>
					<button
						type="button"
						onclick={withStopPropagation(toggleInfo)}
						class="text-gray-400 hover:text-gray-600"
						aria-label="Close info panel"
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-4 space-y-4">
					{#if media.title}
						<div>
							<h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Title</h4>
							<p class="text-gray-900">{media.title}</p>
						</div>
					{/if}

					<div>
						<h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Filename</h4>
						<p class="text-gray-900 text-sm">{basename(media.path)}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</h4>
						<p class="text-gray-900 capitalize">{media.media_type}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">File Size</h4>
						<p class="text-gray-900">{formatBytes(media.size)}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Created</h4>
						<p class="text-gray-900 text-sm">{formatDate(media.birthtime)}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Added to Library</h4>
						<p class="text-gray-900 text-sm">{formatDate(media.created_at)}</p>
					</div>

					<div>
						<h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">File Path</h4>
						<p class="text-gray-700 text-xs break-all font-mono bg-gray-50 p-2 rounded">{media.path}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Edit Panel -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute top-0 right-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out {showEdit ? 'translate-x-0' : 'translate-x-full'}"
			onclick={handlePanelClick}
		>
			<div class="h-full flex flex-col">
				<div class="flex items-center justify-between p-4 border-b border-gray-200">
					<h3 class="text-lg font-semibold text-gray-900">Edit</h3>
					<button
						type="button"
						onclick={withStopPropagation(toggleEdit)}
						class="text-gray-400 hover:text-gray-600"
						aria-label="Close edit panel"
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-4">
					<TagSelector mediaId={media.id} />
				</div>
			</div>
		</div>
	</div>
{/if}
