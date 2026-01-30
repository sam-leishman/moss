<script lang="ts">
	import type { Media } from '$lib/server/db';
	import { basename } from '$lib/utils/path';

	interface Props {
		media: Media | null;
		onClose: () => void;
	}

	let { media, onClose }: Props = $props();

	const handleBackdropClick = (e: MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			onClose();
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
		return new Date(dateString).toLocaleString();
	};
</script>

<svelte:window onkeydown={handleKeydown} />

{#if media}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
			<div class="flex items-center justify-between p-4 border-b border-gray-200">
				<h2 class="text-lg font-semibold text-gray-900 truncate">
					{media.title || basename(media.path)}
				</h2>
				<button
					type="button"
					onclick={onClose}
					class="text-gray-400 hover:text-gray-600 text-2xl leading-none"
				>
					×
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				<div class="grid md:grid-cols-2 gap-6">
					<div class="bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
						{#if media.media_type === 'image' || media.media_type === 'animated'}
							<img
								src="/api/media/{media.id}/file"
								alt={media.title || basename(media.path)}
								class="max-w-full max-h-[600px] object-contain"
							/>
						{:else if media.media_type === 'video'}
							<video
								src="/api/media/{media.id}/file"
								controls
								class="max-w-full max-h-[600px]"
							>
								<track kind="captions" />
							</video>
						{/if}
					</div>

					<div class="space-y-4">
						<div>
							<h3 class="text-sm font-medium text-gray-500 mb-1">Type</h3>
							<p class="text-gray-900 capitalize">{media.media_type}</p>
						</div>

						<div>
							<h3 class="text-sm font-medium text-gray-500 mb-1">File Path</h3>
							<p class="text-gray-900 text-sm break-all">{media.path}</p>
						</div>

						<div>
							<h3 class="text-sm font-medium text-gray-500 mb-1">File Size</h3>
							<p class="text-gray-900">{formatBytes(media.size)}</p>
						</div>

						<div>
							<h3 class="text-sm font-medium text-gray-500 mb-1">Created</h3>
							<p class="text-gray-900">{formatDate(media.birthtime)}</p>
						</div>

						<div>
							<h3 class="text-sm font-medium text-gray-500 mb-1">Added to Library</h3>
							<p class="text-gray-900">{formatDate(media.created_at)}</p>
						</div>

						{#if media.title}
							<div>
								<h3 class="text-sm font-medium text-gray-500 mb-1">Custom Title</h3>
								<p class="text-gray-900">{media.title}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
