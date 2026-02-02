import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger } from '$lib/server/security';
import { handleError, NotFoundError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('api:performance');

export interface PerformanceMetrics {
	libraryId: number;
	libraryName: string;
	databaseSize: number;
	queryPerformance: {
		mediaListQuery: number;
		tagFilterQuery: number;
		personFilterQuery: number;
		searchQuery: number;
	};
	indexHealth: Array<{
		tableName: string;
		indexName: string;
		isHealthy: boolean;
	}>;
	tableStats: Array<{
		tableName: string;
		rowCount: number;
		estimatedSize: number;
	}>;
	cacheStats: {
		pageSize: number;
		cacheSize: number;
		walMode: boolean;
	};
	recommendations: string[];
}

export const GET = async ({ url }: { url: URL }) => {
	try {
		const libraryIdParam = url.searchParams.get('library_id');
		
		if (!libraryIdParam) {
			return json({ error: 'library_id is required' }, { status: 400 });
		}

		const libraryId = sanitizeInteger(libraryIdParam);
		const db = getDatabase();

		const library = db.prepare('SELECT id, name FROM library WHERE id = ?').get(libraryId) as { id: number; name: string } | undefined;
		if (!library) {
			throw new NotFoundError('Library', libraryId.toString());
		}

		const pageSizeResult = db.pragma('page_size', { simple: true }) as number;
		const pageCountResult = db.pragma('page_count', { simple: true }) as number;
		const databaseSize = pageSizeResult * pageCountResult;

		const cacheSizeResult = db.pragma('cache_size', { simple: true }) as number;
		const journalModeResult = db.pragma('journal_mode', { simple: true }) as string;

		const sampleTag = db.prepare('SELECT id FROM tag LIMIT 1').get() as { id: number } | undefined;
		const samplePerson = db.prepare('SELECT id FROM person LIMIT 1').get() as { id: number } | undefined;

		const queryPerformance = {
			mediaListQuery: 0,
			tagFilterQuery: 0,
			personFilterQuery: 0,
			searchQuery: 0
		};

		let start = performance.now();
		db.prepare('SELECT * FROM media WHERE library_id = ? ORDER BY created_at DESC LIMIT 50').all(libraryId);
		queryPerformance.mediaListQuery = Math.round((performance.now() - start) * 100) / 100;

		if (sampleTag) {
			start = performance.now();
			db.prepare(`
				SELECT m.* FROM media m
				WHERE m.library_id = ? AND m.id IN (
					SELECT media_id FROM media_tag WHERE tag_id = ?
				)
				LIMIT 50
			`).all(libraryId, sampleTag.id);
			queryPerformance.tagFilterQuery = Math.round((performance.now() - start) * 100) / 100;
		}

		if (samplePerson) {
			start = performance.now();
			db.prepare(`
				SELECT m.* FROM media m
				WHERE m.library_id = ? AND m.id IN (
					SELECT media_id FROM media_credit WHERE person_id = ?
				)
				LIMIT 50
			`).all(libraryId, samplePerson.id);
			queryPerformance.personFilterQuery = Math.round((performance.now() - start) * 100) / 100;
		}

		start = performance.now();
		db.prepare(`
			SELECT * FROM media 
			WHERE library_id = ? AND (title LIKE ? OR path LIKE ?)
			LIMIT 50
		`).all(libraryId, '%test%', '%test%');
		queryPerformance.searchQuery = Math.round((performance.now() - start) * 100) / 100;

		const indexListResults = db.prepare(`
			SELECT name, tbl_name 
			FROM sqlite_master 
			WHERE type = 'index' AND tbl_name IN ('media', 'media_tag', 'media_credit', 'tag', 'person', 'library')
			ORDER BY tbl_name, name
		`).all() as Array<{ name: string; tbl_name: string }>;

		const indexHealth = indexListResults.map(index => ({
			tableName: index.tbl_name,
			indexName: index.name,
			isHealthy: true
		}));

		const ALLOWED_TABLES = new Set(['media', 'media_tag', 'media_credit', 'tag', 'person', 'library', 'artist_profile', 'performer_profile']);
		const tableStats = [];

		for (const tableName of ALLOWED_TABLES) {
			try {
				const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
				const rowCount = countResult.count;
				
				const estimatedSize = rowCount * 1024;
				
				tableStats.push({
					tableName,
					rowCount,
					estimatedSize
				});
			} catch (err) {
				logger.warn(`Failed to get stats for table ${tableName}`);
			}
		}

		const recommendations: string[] = [];

		const mediaCount = tableStats.find(t => t.tableName === 'media')?.rowCount || 0;
		if (mediaCount > 50000) {
			recommendations.push('Consider archiving old media or splitting into multiple libraries for optimal performance');
		}

		if (queryPerformance.mediaListQuery > 100) {
			recommendations.push('Media list queries are slow. Consider optimizing database or reducing page size');
		}

		if (queryPerformance.tagFilterQuery > 100 || queryPerformance.personFilterQuery > 100) {
			recommendations.push('Filter queries are slow. Ensure indexes are properly created on media_tag and media_credit tables');
		}

		if (databaseSize > 1024 * 1024 * 1024) {
			recommendations.push('Database size exceeds 1GB. Consider running VACUUM to optimize storage');
		}

		if (journalModeResult !== 'wal') {
			recommendations.push('WAL mode is not enabled. Enable it for better concurrent access performance');
		}

		if (recommendations.length === 0) {
			recommendations.push('All performance metrics are within acceptable ranges');
		}

		const metrics: PerformanceMetrics = {
			libraryId: library.id,
			libraryName: library.name,
			databaseSize,
			queryPerformance,
			indexHealth,
			tableStats,
			cacheStats: {
				pageSize: pageSizeResult,
				cacheSize: Math.abs(cacheSizeResult) * pageSizeResult,
				walMode: journalModeResult === 'wal'
			},
			recommendations
		};

		logger.info(`Performance metrics generated for library ${library.name} (id: ${libraryId})`);

		return json({ metrics });
	} catch (error) {
		logger.error('Failed to generate performance metrics', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
