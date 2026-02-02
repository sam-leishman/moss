import { json } from '@sveltejs/kit';
import { getDatabase, SCHEMA_VERSION } from '$lib/server/db';
import { handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';
import type { Library, Media, Tag, Person, ArtistProfile, PerformerProfile, MediaTag, MediaCredit } from '$lib/server/db/types';

const logger = getLogger('api:export');

interface ExportData {
	version: number;
	exportedAt: string;
	libraries: Library[];
	media: Media[];
	tags: Tag[];
	people: Person[];
	artistProfiles: ArtistProfile[];
	performerProfiles: PerformerProfile[];
	mediaTags: MediaTag[];
	mediaCredits: MediaCredit[];
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const db = getDatabase();
		const libraryId = url.searchParams.get('library_id');
		
		let exportData: ExportData;
		
		if (libraryId) {
			// Export specific library
			const libId = parseInt(libraryId, 10);
			
			const library = db.prepare('SELECT * FROM library WHERE id = ?').get(libId) as Library | undefined;
			if (!library) {
				return json({ error: 'Library not found' }, { status: 404 });
			}
			
			const media = db.prepare('SELECT * FROM media WHERE library_id = ?').all(libId) as Media[];
			const mediaIds = media.map(m => m.id);
			
			// Get tags for this library (library-specific and global)
			const tags = db.prepare(
				'SELECT * FROM tag WHERE library_id = ? OR is_global = 1'
			).all(libId) as Tag[];
			
			// Get people for this library (library-specific and global)
			const people = db.prepare(
				'SELECT * FROM person WHERE library_id = ? OR is_global = 1'
			).all(libId) as Person[];
			const personIds = people.map(p => p.id);
			
			// Get profiles for these people
			const artistProfiles = personIds.length > 0
				? db.prepare(
					`SELECT * FROM artist_profile WHERE person_id IN (${personIds.map(() => '?').join(',')})`
				).all(...personIds) as ArtistProfile[]
				: [];
			
			const performerProfiles = personIds.length > 0
				? db.prepare(
					`SELECT * FROM performer_profile WHERE person_id IN (${personIds.map(() => '?').join(',')})`
				).all(...personIds) as PerformerProfile[]
				: [];
			
			// Get media tags and credits for this library's media
			const mediaTags = mediaIds.length > 0
				? db.prepare(
					`SELECT * FROM media_tag WHERE media_id IN (${mediaIds.map(() => '?').join(',')})`
				).all(...mediaIds) as MediaTag[]
				: [];
			
			const mediaCredits = mediaIds.length > 0
				? db.prepare(
					`SELECT * FROM media_credit WHERE media_id IN (${mediaIds.map(() => '?').join(',')})`
				).all(...mediaIds) as MediaCredit[]
				: [];
			
			exportData = {
				version: SCHEMA_VERSION,
				exportedAt: new Date().toISOString(),
				libraries: [library],
				media,
				tags,
				people,
				artistProfiles,
				performerProfiles,
				mediaTags,
				mediaCredits
			};
			
			logger.info(`Exported library ${library.name} (${media.length} media items)`);
		} else {
			// Export all data
			const libraries = db.prepare('SELECT * FROM library').all() as Library[];
			const media = db.prepare('SELECT * FROM media').all() as Media[];
			const tags = db.prepare('SELECT * FROM tag').all() as Tag[];
			const people = db.prepare('SELECT * FROM person').all() as Person[];
			const artistProfiles = db.prepare('SELECT * FROM artist_profile').all() as ArtistProfile[];
			const performerProfiles = db.prepare('SELECT * FROM performer_profile').all() as PerformerProfile[];
			const mediaTags = db.prepare('SELECT * FROM media_tag').all() as MediaTag[];
			const mediaCredits = db.prepare('SELECT * FROM media_credit').all() as MediaCredit[];
			
			exportData = {
				version: SCHEMA_VERSION,
				exportedAt: new Date().toISOString(),
				libraries,
				media,
				tags,
				people,
				artistProfiles,
				performerProfiles,
				mediaTags,
				mediaCredits
			};
			
			logger.info(`Exported all data (${libraries.length} libraries, ${media.length} media items)`);
		}
		
		return json(exportData);
	} catch (error) {
		logger.error('Failed to export data', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
