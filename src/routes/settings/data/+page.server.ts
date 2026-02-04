import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';

export const load = async ({ locals }) => {
	// Require admin access to manage data
	try {
		requireAdmin(locals);
	} catch {
		// Redirect non-admins to root
		throw redirect(302, '/');
	}
	
	return {};
};
