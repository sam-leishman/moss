import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { handleError, NotFoundError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('api:statistics');

export interface LibraryStatistics {
	libraryId: number | null;
	libraryName: string;
	totalMedia: number;
	mediaByType: {
		image: number;
		video: number;
		animated: number;
	};
	totalTags: number;
	totalPeople: number;
	totalCredits: number;
	averageTagsPerMedia: number;
	averageCreditsPerMedia: number;
	topTags: Array<{ id: number; name: string; count: number }>;
	topPeople: Array<{ id: number; name: string; role: string; count: number }>;
	mediaWithoutTags: number;
	mediaWithoutCredits: number;
	totalSize: number;
	averageSize: number;
	oldestMedia: string | null;
	newestMedia: string | null;
}

export const GET = async ({ url }: { url: URL }) => {
	try {
		const libraryIdParam = url.searchParams.get('library_id');
		const db = getDatabase();

		let libraryId: number | null = null;
		let libraryName = 'All Libraries';

		if (libraryIdParam) {
			libraryId = sanitizeInteger(libraryIdParam);
			const library = db.prepare('SELECT id, name FROM library WHERE id = ?').get(libraryId) as { id: number; name: string } | undefined;
			if (!library) {
				throw new NotFoundError('Library', libraryId.toString());
			}
			libraryName = library.name;
		}

		const libraryFilter = libraryId !== null ? 'WHERE library_id = ?' : '';
		const libraryParams = libraryId !== null ? [libraryId] : [];

		const totalMediaResult = db.prepare(`SELECT COUNT(*) as count FROM media ${libraryFilter}`).get(...libraryParams) as { count: number };
		const totalMedia = totalMediaResult.count;

		const mediaByTypeResults = db.prepare(`
			SELECT media_type, COUNT(*) as count 
			FROM media 
			${libraryFilter}
			GROUP BY media_type
		`).all(...libraryParams) as Array<{ media_type: 'image' | 'video' | 'animated'; count: number }>;

		const mediaByType = {
			image: 0,
			video: 0,
			animated: 0
		};
		for (const result of mediaByTypeResults) {
			mediaByType[result.media_type] = result.count;
		}

		const mediaSubquery = libraryId !== null 
			? 'SELECT id FROM media WHERE library_id = ?'
			: 'SELECT id FROM media';
		const mediaSubqueryParams = libraryId !== null ? [libraryId] : [];

		const totalTagsResult = db.prepare(`
			SELECT COUNT(DISTINCT tag_id) as count 
			FROM media_tag 
			WHERE media_id IN (${mediaSubquery})
		`).get(...mediaSubqueryParams) as { count: number };
		const totalTags = totalTagsResult.count;

		const totalPeopleResult = db.prepare(`
			SELECT COUNT(DISTINCT person_id) as count 
			FROM media_credit 
			WHERE media_id IN (${mediaSubquery})
		`).get(...mediaSubqueryParams) as { count: number };
		const totalPeople = totalPeopleResult.count;

		const totalCreditsResult = db.prepare(`
			SELECT COUNT(*) as count 
			FROM media_credit 
			WHERE media_id IN (${mediaSubquery})
		`).get(...mediaSubqueryParams) as { count: number };
		const totalCredits = totalCreditsResult.count;

		const averageTagsPerMedia = totalMedia > 0 ? 
			(db.prepare(`
				SELECT COUNT(*) as count 
				FROM media_tag 
				WHERE media_id IN (${mediaSubquery})
			`).get(...mediaSubqueryParams) as { count: number }).count / totalMedia : 0;

		const averageCreditsPerMedia = totalMedia > 0 ? totalCredits / totalMedia : 0;

		const topTags = db.prepare(`
			SELECT t.id, t.name, COUNT(mt.media_id) as count
			FROM tag t
			JOIN media_tag mt ON t.id = mt.tag_id
			WHERE mt.media_id IN (${mediaSubquery})
			GROUP BY t.id, t.name
			ORDER BY count DESC
			LIMIT 10
		`).all(...mediaSubqueryParams) as Array<{ id: number; name: string; count: number }>;

		const topPeople = db.prepare(`
			SELECT p.id, p.name, p.role, COUNT(mc.media_id) as count
			FROM person p
			JOIN media_credit mc ON p.id = mc.person_id
			WHERE mc.media_id IN (${mediaSubquery})
			GROUP BY p.id, p.name, p.role
			ORDER BY count DESC
			LIMIT 10
		`).all(...mediaSubqueryParams) as Array<{ id: number; name: string; role: string; count: number }>;

		const whereOrAnd = libraryId !== null ? 'AND' : 'WHERE';
		
		const mediaWithoutTagsResult = db.prepare(`
			SELECT COUNT(*) as count 
			FROM media m
			${libraryFilter}
			${whereOrAnd} m.id NOT IN (SELECT DISTINCT media_id FROM media_tag)
		`).get(...libraryParams) as { count: number };
		const mediaWithoutTags = mediaWithoutTagsResult.count;

		const mediaWithoutCreditsResult = db.prepare(`
			SELECT COUNT(*) as count 
			FROM media m
			${libraryFilter}
			${whereOrAnd} m.id NOT IN (SELECT DISTINCT media_id FROM media_credit)
		`).get(...libraryParams) as { count: number };
		const mediaWithoutCredits = mediaWithoutCreditsResult.count;

		const sizeStatsResult = db.prepare(`
			SELECT 
				SUM(size) as totalSize,
				AVG(size) as averageSize
			FROM media 
			${libraryFilter}
		`).get(...libraryParams) as { totalSize: number | null; averageSize: number | null };

		const totalSize = sizeStatsResult.totalSize || 0;
		const averageSize = sizeStatsResult.averageSize || 0;

		const dateStatsResult = db.prepare(`
			SELECT 
				MIN(birthtime) as oldest,
				MAX(birthtime) as newest
			FROM media 
			${libraryFilter}
		`).get(...libraryParams) as { oldest: string | null; newest: string | null };

		const statistics: LibraryStatistics = {
			libraryId: libraryId,
			libraryName: libraryName,
			totalMedia,
			mediaByType,
			totalTags,
			totalPeople,
			totalCredits,
			averageTagsPerMedia: Math.round(averageTagsPerMedia * 100) / 100,
			averageCreditsPerMedia: Math.round(averageCreditsPerMedia * 100) / 100,
			topTags,
			topPeople,
			mediaWithoutTags,
			mediaWithoutCredits,
			totalSize,
			averageSize: Math.round(averageSize),
			oldestMedia: dateStatsResult.oldest,
			newestMedia: dateStatsResult.newest
		};

		logger.info(`Statistics generated for ${libraryName}${libraryId !== null ? ` (id: ${libraryId})` : ''}`);

		return json({ statistics });
	} catch (error) {
		logger.error('Failed to generate statistics', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
