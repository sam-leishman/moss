import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	// Get parent data (which already validates library access)
	const parentData = await parent();
	
	// Require admin access to manage library
	try {
		requireAdmin({ user: locals.user });
	} catch {
		// Redirect non-admins to library page
		throw redirect(302, `/libraries/${parentData.library.id}`);
	}
	
	return {
		library: parentData.library
	};
};
