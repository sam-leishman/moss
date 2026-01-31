<script lang="ts">
	import { page } from '$app/stores';
	import { User } from 'lucide-svelte';
	import type { Person, ArtistProfile, PerformerProfile, Media } from '$lib/server/db';
	import { basename } from '$lib/utils/path';

	let person = $state<Person | null>(null);
	let profile = $state<ArtistProfile | PerformerProfile | null>(null);
	let creditedMedia = $state<Media[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const personId = $derived($page.params.personId);
	const libraryId = $derived($page.params.id);

	const loadPerson = async () => {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/people/${personId}`);
			if (!response.ok) {
				if (response.status === 404) {
					error = 'Person not found';
				} else {
					throw new Error('Failed to fetch person');
				}
				return;
			}
			const data = await response.json();
			person = data.person;
			profile = data.profile;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load person';
		} finally {
			loading = false;
		}
	};

	const loadCreditedMedia = async () => {
		try {
			const response = await fetch(`/api/people/${personId}/media`);
			if (response.ok) {
				creditedMedia = await response.json();
			}
		} catch (err) {
			console.error('Failed to load credited media', err);
		}
	};

	const formatStyleLabel = (style: string | null): string => {
		if (!style) return 'Not specified';
		return style.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
	};

	$effect(() => {
		loadPerson();
		loadCreditedMedia();
	});
</script>

{#if loading}
	<div class="text-center py-12 text-gray-500">Loading...</div>
{:else if error}
	<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
		{error}
	</div>
{:else if person}
	<div class="bg-white rounded-lg shadow-md p-8">
		<div class="flex items-start gap-6 mb-8">
			<div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
				<User class="w-10 h-10 text-gray-600" />
			</div>
			<div class="flex-1">
				<h1 class="text-3xl font-bold text-gray-900 mb-2">{person.name}</h1>
				<p class="text-lg text-gray-600 capitalize mb-4">{person.role}</p>
				
				{#if person.role === 'artist' && profile}
					<div class="space-y-2">
						<div>
							<span class="text-sm font-medium text-gray-500">Style:</span>
							<span class="ml-2 text-gray-900">{formatStyleLabel((profile as ArtistProfile).style)}</span>
						</div>
					</div>
				{:else if person.role === 'performer' && profile}
					<div class="space-y-2">
						{#if (profile as PerformerProfile).age !== null}
							<div>
								<span class="text-sm font-medium text-gray-500">Age:</span>
								<span class="ml-2 text-gray-900">{(profile as PerformerProfile).age}</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="border-t border-gray-200 pt-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Credited Media</h2>
			
			{#if creditedMedia.length > 0}
				<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{#each creditedMedia as media (media.id)}
						<a
							href="/libraries/{media.library_id}?media={media.id}"
							class="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
						>
							<img
								src="/api/media/{media.id}/thumbnail"
								alt={media.title || basename(media.path)}
								class="w-full h-full object-cover"
							/>
							<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
								<p class="text-white text-sm truncate">{media.title || basename(media.path)}</p>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<p class="text-gray-500">No media items credited yet</p>
			{/if}
		</div>

		<div class="border-t border-gray-200 pt-6 mt-6">
			<div class="text-sm text-gray-500 space-y-1">
				<p>Created: {new Date(person.created_at).toLocaleString()}</p>
				<p>Last updated: {new Date(person.updated_at).toLocaleString()}</p>
			</div>
		</div>
	</div>
{/if}
