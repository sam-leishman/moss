import { browser } from '$app/environment';

class LikesStore {
	likedMediaIds = $state<Set<number>>(new Set());
	loading = $state(false);
	initialized = $state(false);

	async init() {
		if (!browser || this.initialized) {
			return;
		}

		this.loading = true;
		try {
			const response = await fetch('/api/media/liked');
			
			if (response.ok) {
				const data = await response.json();
				this.likedMediaIds = new Set(data.mediaIds);
			} else {
				this.likedMediaIds = new Set();
			}
		} catch (error) {
			console.error('Failed to load liked media:', error);
			this.likedMediaIds = new Set();
		} finally {
			this.loading = false;
			this.initialized = true;
		}
	}

	async toggleLike(mediaId: number): Promise<boolean> {
		const wasLiked = this.likedMediaIds.has(mediaId);
		
		// Store original state for rollback
		const originalLikedIds = new Set(this.likedMediaIds);
		
		// Optimistic update
		const newLikedIds = new Set(this.likedMediaIds);
		if (wasLiked) {
			newLikedIds.delete(mediaId);
		} else {
			newLikedIds.add(mediaId);
		}
		this.likedMediaIds = newLikedIds;

		try {
			const response = await fetch(`/api/media/${mediaId}/like`, {
				method: 'POST'
			});

			if (response.ok) {
				const data = await response.json();
				
				// Final update
				const finalLikedIds = new Set(this.likedMediaIds);
				if (data.liked) {
					finalLikedIds.add(mediaId);
				} else {
					finalLikedIds.delete(mediaId);
				}
				this.likedMediaIds = finalLikedIds;
				
				return data.liked;
			} else {
				// Revert to original state
				this.likedMediaIds = originalLikedIds;
				throw new Error('Failed to toggle like');
			}
		} catch (error) {
			// Revert to original state
			this.likedMediaIds = originalLikedIds;
			throw error;
		}
	}

	isLiked(mediaId: number): boolean {
		return this.likedMediaIds.has(mediaId);
	}

	clear() {
		this.likedMediaIds = new Set(); // Create empty Set for reactivity
		this.initialized = false;
	}
}

export const likesStore = new LikesStore();
