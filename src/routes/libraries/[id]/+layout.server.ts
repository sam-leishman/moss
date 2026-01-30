import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Library } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	const db = getDatabase();
	const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;

	if (!library) {
		error(404, `Library not found`);
	}

	return {
		library
	};
};
