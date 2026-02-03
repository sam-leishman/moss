import { redirect } from '@sveltejs/kit';
import { getLastLibraryId } from '$lib/utils/storage';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	// Fetch all libraries
	const response = await fetch('/api/libraries');
	if (!response.ok) {
		throw new Error('Failed to load libraries');
	}
	
	const data = await response.json();
	const libraries = data.libraries || [];
	
	// If no libraries exist, redirect to library creation page
	if (libraries.length === 0) {
		throw redirect(302, '/libraries/create');
	}
	
	// Check for last-used library in localStorage
	const lastLibraryId = getLastLibraryId();
	
	// If we have a last-used library and it exists, redirect to it
	if (lastLibraryId) {
		const libraryExists = libraries.some((lib: { id: number }) => lib.id === lastLibraryId);
		if (libraryExists) {
			throw redirect(302, `/libraries/${lastLibraryId}`);
		}
	}
	
	// Otherwise, redirect to the first library
	throw redirect(302, `/libraries/${libraries[0].id}`);
};
