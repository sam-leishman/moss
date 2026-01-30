import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { Media } from '$lib/server/db';
import { sanitizeInteger, sanitizePositiveInteger, sanitizeMediaType } from '$lib/server/security';
import type { RequestHandler } from './$types';

export interface MediaListResponse {
	items: Media[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export const GET: RequestHandler = async ({ url }) => {
	const db = getDatabase();

	const libraryIdParam = url.searchParams.get('library_id');
	const pageParam = url.searchParams.get('page') || '1';
	const pageSizeParam = url.searchParams.get('page_size') || '100';
	const mediaTypeParam = url.searchParams.get('media_type');
	const searchParam = url.searchParams.get('search');

	if (!libraryIdParam) {
		error(400, 'library_id is required');
	}

	const libraryId = sanitizeInteger(libraryIdParam);
	const page = sanitizePositiveInteger(pageParam);
	const pageSize = Math.min(sanitizePositiveInteger(pageSizeParam), 100);
	const offset = (page - 1) * pageSize;

	const library = db.prepare('SELECT id, folder_path FROM library WHERE id = ?').get(libraryId) as { id: number; folder_path: string } | undefined;
	if (!library) {
		error(404, 'Library not found');
	}

	const whereConditions: string[] = ['library_id = ?'];
	const countParams: (string | number)[] = [libraryId];
	const queryParams: (string | number)[] = [libraryId];

	if (mediaTypeParam) {
		const mediaType = sanitizeMediaType(mediaTypeParam);
		whereConditions.push('media_type = ?');
		countParams.push(mediaType);
		queryParams.push(mediaType);
	}

	if (searchParam && searchParam.trim()) {
		const searchTerm = `%${searchParam.trim()}%`;
		// For path search, use SUBSTR to strip library folder path prefix
		// This ensures we only search within the relative path of the library
		const folderPathLength = library.folder_path.length + 1; // +1 for trailing slash
		whereConditions.push('(title LIKE ? OR SUBSTR(path, ?) LIKE ?)');
		countParams.push(searchTerm, folderPathLength, searchTerm);
		queryParams.push(searchTerm, folderPathLength, searchTerm);
	}

	const whereClause = whereConditions.join(' AND ');

	const countStmt = db.prepare(`SELECT COUNT(*) as count FROM media WHERE ${whereClause}`);
	const countResult = countStmt.get(...countParams) as { count: number };
	const total = countResult.count;

	queryParams.push(pageSize, offset);
	const mediaStmt = db.prepare(`
		SELECT * FROM media 
		WHERE ${whereClause}
		ORDER BY created_at DESC, id DESC
		LIMIT ? OFFSET ?
	`);
	const items = mediaStmt.all(...queryParams) as Media[];

	const totalPages = Math.ceil(total / pageSize);

	return json({
		items,
		total,
		page,
		pageSize,
		totalPages
	} satisfies MediaListResponse);
};
