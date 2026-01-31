import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Library } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';
import { existsSync } from 'fs';

export const load: LayoutServerLoad = async ({ params }) => {
	const db = getDatabase();
	const library = db.prepare('SELECT * FROM library WHERE id = ?').get(params.id) as Library | undefined;

	if (!library) {
		error(404, `Library not found`);
	}

	// Check if library folder exists and update status if needed
	const pathExists = existsSync(library.folder_path);
	
	if (!pathExists && library.path_status === 'ok') {
		db.prepare(`
			UPDATE library 
			SET path_status = 'missing', 
			    path_error = ?,
			    updated_at = datetime('now')
			WHERE id = ?
		`).run('Library folder does not exist or is not accessible', library.id);
		
		library.path_status = 'missing';
		library.path_error = 'Library folder does not exist or is not accessible';
	} else if (pathExists && library.path_status === 'missing') {
		db.prepare(`
			UPDATE library 
			SET path_status = 'ok', 
			    path_error = NULL,
			    updated_at = datetime('now')
			WHERE id = ?
		`).run(library.id);
		
		library.path_status = 'ok';
		library.path_error = null;
	}

	return {
		library
	};
};
