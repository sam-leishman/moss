import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Require admin access to create libraries
	try {
		requireAdmin(locals);
	} catch {
		// Redirect non-admins to root - let existing routing logic handle it
		throw redirect(302, '/');
	}
	
	// Admins can proceed - no data needed
	return {};
};
