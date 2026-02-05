import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	// Fetch all libraries
	const response = await fetch('/api/libraries');
	if (response.status === 401) {
		throw redirect(302, '/login');
	}
	if (!response.ok) {
		throw new Error('Failed to load libraries');
	}

	const data = await response.json();
	const libraries = data.libraries || [];

	return {
		libraries
	};
};
