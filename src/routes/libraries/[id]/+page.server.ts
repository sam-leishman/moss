import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { library } = await parent();
	
	return {
		library
	};
};
