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
	const tagIdsParam = url.searchParams.get('tag_ids');

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

	// Tag filtering with indexed queries
	let tagIds: number[] = [];
	if (tagIdsParam && tagIdsParam.trim()) {
		tagIds = tagIdsParam.split(',').map(id => sanitizeInteger(id.trim())).filter(id => id > 0);
	}

	const whereClause = whereConditions.join(' AND ');

	let countStmt;
	let mediaStmt;
	let total: number;
	let items: Media[];

	if (tagIds.length > 0) {
		// Filter by tags using indexed media_tag table
		// Use INTERSECT to ensure media has ALL specified tags (AND logic)
		const tagFilterQuery = tagIds.map(() => `
			SELECT media_id FROM media_tag WHERE tag_id = ?
		`).join(' INTERSECT ');

		countStmt = db.prepare(`
			SELECT COUNT(*) as count FROM media 
			WHERE ${whereClause} AND id IN (${tagFilterQuery})
		`);
		const countResult = countStmt.get(...countParams, ...tagIds) as { count: number };
		total = countResult.count;

		queryParams.push(...tagIds, pageSize, offset);
		mediaStmt = db.prepare(`
			SELECT * FROM media 
			WHERE ${whereClause} AND id IN (${tagFilterQuery})
			ORDER BY created_at DESC, id DESC
			LIMIT ? OFFSET ?
		`);
		items = mediaStmt.all(...queryParams) as Media[];
	} else {
		// No tag filtering
		countStmt = db.prepare(`SELECT COUNT(*) as count FROM media WHERE ${whereClause}`);
		const countResult = countStmt.get(...countParams) as { count: number };
		total = countResult.count;

		queryParams.push(pageSize, offset);
		mediaStmt = db.prepare(`
			SELECT * FROM media 
			WHERE ${whereClause}
			ORDER BY created_at DESC, id DESC
			LIMIT ? OFFSET ?
		`);
		items = mediaStmt.all(...queryParams) as Media[];
	}

	const totalPages = Math.ceil(total / pageSize);

	return json({
		items,
		total,
		page,
		pageSize,
		totalPages
	} satisfies MediaListResponse);
};
