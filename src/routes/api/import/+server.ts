import { json } from '@sveltejs/kit';
import { getDatabase, SCHEMA_VERSION } from '$lib/server/db';
import { handleError, ValidationError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { RequestHandler } from './$types';
import type { Library, Media, Tag, Person, ArtistProfile, PerformerProfile, MediaTag, MediaCredit } from '$lib/server/db/types';

const logger = getLogger('api:import');

interface ImportData {
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

interface ImportStats {
	libraries: { added: number; skipped: number; errors: number };
	media: { added: number; updated: number; skipped: number; errors: number };
	tags: { added: number; skipped: number; errors: number };
	people: { added: number; skipped: number; errors: number };
	artistProfiles: { added: number; skipped: number; errors: number };
	performerProfiles: { added: number; skipped: number; errors: number };
	mediaTags: { added: number; skipped: number; errors: number };
	mediaCredits: { added: number; skipped: number; errors: number };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const importData = await request.json() as ImportData;

		if (!importData.version || !importData.exportedAt) {
			throw new ValidationError('Invalid import data format');
		}

		if (importData.version > SCHEMA_VERSION) {
			throw new ValidationError(
				`Import data version (${importData.version}) is newer than application version (${SCHEMA_VERSION}). Please update the application.`
			);
		}

		const db = getDatabase();
		const stats: ImportStats = {
			libraries: { added: 0, skipped: 0, errors: 0 },
			media: { added: 0, updated: 0, skipped: 0, errors: 0 },
			tags: { added: 0, skipped: 0, errors: 0 },
			people: { added: 0, skipped: 0, errors: 0 },
			artistProfiles: { added: 0, skipped: 0, errors: 0 },
			performerProfiles: { added: 0, skipped: 0, errors: 0 },
			mediaTags: { added: 0, skipped: 0, errors: 0 },
			mediaCredits: { added: 0, skipped: 0, errors: 0 }
		};

		// Map old IDs to new IDs
		const libraryIdMap = new Map<number, number>();
		const mediaIdMap = new Map<number, number>();
		const tagIdMap = new Map<number, number>();
		const personIdMap = new Map<number, number>();

		// Wrap everything in a transaction
		const importTransaction = db.transaction(() => {
			// Import libraries
			for (const library of importData.libraries) {
				try {
					const existing = db.prepare('SELECT id FROM library WHERE folder_path = ?').get(library.folder_path) as { id: number } | undefined;
					
					if (existing) {
						libraryIdMap.set(library.id, existing.id);
						stats.libraries.skipped++;
					} else {
						const result = db.prepare(
							'INSERT INTO library (name, folder_path, path_status, path_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
						).run(library.name, library.folder_path, library.path_status, library.path_error, library.created_at, library.updated_at);
						
						libraryIdMap.set(library.id, Number(result.lastInsertRowid));
						stats.libraries.added++;
					}
				} catch (error) {
					logger.error(`Failed to import library ${library.name}`, error instanceof Error ? error : undefined);
					stats.libraries.errors++;
				}
			}

			// Import tags
			for (const tag of importData.tags) {
				try {
					const newLibraryId = tag.library_id ? libraryIdMap.get(tag.library_id) : null;
					
					// Skip if library-specific tag and library wasn't imported
					if (tag.library_id && !newLibraryId) {
						stats.tags.skipped++;
						continue;
					}
					
					const existing = db.prepare(
						'SELECT id FROM tag WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL))'
					).get(tag.name, newLibraryId, newLibraryId) as { id: number } | undefined;
					
					if (existing) {
						tagIdMap.set(tag.id, existing.id);
						stats.tags.skipped++;
					} else {
						const result = db.prepare(
							'INSERT INTO tag (name, library_id, is_global, created_at) VALUES (?, ?, ?, ?)'
						).run(tag.name, newLibraryId, tag.is_global, tag.created_at);
						
						tagIdMap.set(tag.id, Number(result.lastInsertRowid));
						stats.tags.added++;
					}
				} catch (error) {
					logger.error(`Failed to import tag ${tag.name}`, error instanceof Error ? error : undefined);
					stats.tags.errors++;
				}
			}

			// Import people
			for (const person of importData.people) {
				try {
					const newLibraryId = person.library_id ? libraryIdMap.get(person.library_id) : null;
					
					// Skip if library-specific person and library wasn't imported
					if (person.library_id && !newLibraryId) {
						stats.people.skipped++;
						continue;
					}
					
					const existing = db.prepare(
						'SELECT id FROM person WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL))'
					).get(person.name, newLibraryId, newLibraryId) as { id: number } | undefined;
					
					if (existing) {
						personIdMap.set(person.id, existing.id);
						stats.people.skipped++;
					} else {
						const result = db.prepare(
							'INSERT INTO person (name, role, library_id, is_global, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
						).run(person.name, person.role, newLibraryId, person.is_global, person.created_at, person.updated_at);
						
						personIdMap.set(person.id, Number(result.lastInsertRowid));
						stats.people.added++;
					}
				} catch (error) {
					logger.error(`Failed to import person ${person.name}`, error instanceof Error ? error : undefined);
					stats.people.errors++;
				}
			}

			// Import artist profiles
			for (const profile of importData.artistProfiles) {
				try {
					const newPersonId = personIdMap.get(profile.person_id);
					
					if (!newPersonId) {
						stats.artistProfiles.skipped++;
						continue;
					}
					
					const existing = db.prepare('SELECT person_id FROM artist_profile WHERE person_id = ?').get(newPersonId);
					
					if (existing) {
						stats.artistProfiles.skipped++;
					} else {
						db.prepare(
							'INSERT INTO artist_profile (person_id, style, created_at, updated_at) VALUES (?, ?, ?, ?)'
						).run(newPersonId, profile.style, profile.created_at, profile.updated_at);
						
						stats.artistProfiles.added++;
					}
				} catch (error) {
					logger.error(`Failed to import artist profile for person ${profile.person_id}`, error instanceof Error ? error : undefined);
					stats.artistProfiles.errors++;
				}
			}

			// Import performer profiles
			for (const profile of importData.performerProfiles) {
				try {
					const newPersonId = personIdMap.get(profile.person_id);
					
					if (!newPersonId) {
						stats.performerProfiles.skipped++;
						continue;
					}
					
					const existing = db.prepare('SELECT person_id FROM performer_profile WHERE person_id = ?').get(newPersonId);
					
					if (existing) {
						stats.performerProfiles.skipped++;
					} else {
						db.prepare(
							'INSERT INTO performer_profile (person_id, age, created_at, updated_at) VALUES (?, ?, ?, ?)'
						).run(newPersonId, profile.age, profile.created_at, profile.updated_at);
						
						stats.performerProfiles.added++;
					}
				} catch (error) {
					logger.error(`Failed to import performer profile for person ${profile.person_id}`, error instanceof Error ? error : undefined);
					stats.performerProfiles.errors++;
				}
			}

			// Import media
			for (const media of importData.media) {
				try {
					const newLibraryId = libraryIdMap.get(media.library_id);
					
					if (!newLibraryId) {
						stats.media.skipped++;
						continue;
					}
					
					const existing = db.prepare('SELECT id FROM media WHERE path = ?').get(media.path) as { id: number } | undefined;
					
					if (existing) {
						// Update title only - preserve file system properties (size, dates)
						db.prepare(
							'UPDATE media SET title = ?, updated_at = ? WHERE id = ?'
						).run(media.title, new Date().toISOString(), existing.id);
						
						mediaIdMap.set(media.id, existing.id);
						stats.media.updated++;
					} else {
						const result = db.prepare(
							'INSERT INTO media (library_id, path, title, media_type, size, mtime, birthtime, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
						).run(newLibraryId, media.path, media.title, media.media_type, media.size, media.mtime, media.birthtime, media.created_at, media.updated_at);
						
						mediaIdMap.set(media.id, Number(result.lastInsertRowid));
						stats.media.added++;
					}
				} catch (error) {
					logger.error(`Failed to import media ${media.path}`, error instanceof Error ? error : undefined);
					stats.media.errors++;
				}
			}

			// Import media tags
			for (const mediaTag of importData.mediaTags) {
				try {
					const newMediaId = mediaIdMap.get(mediaTag.media_id);
					const newTagId = tagIdMap.get(mediaTag.tag_id);
					
					if (!newMediaId || !newTagId) {
						stats.mediaTags.skipped++;
						continue;
					}
					
					const existing = db.prepare(
						'SELECT 1 FROM media_tag WHERE media_id = ? AND tag_id = ?'
					).get(newMediaId, newTagId);
					
					if (existing) {
						stats.mediaTags.skipped++;
					} else {
						db.prepare(
							'INSERT INTO media_tag (media_id, tag_id, created_at) VALUES (?, ?, ?)'
						).run(newMediaId, newTagId, mediaTag.created_at);
						
						stats.mediaTags.added++;
					}
				} catch (error) {
					logger.error(`Failed to import media tag relationship`, error instanceof Error ? error : undefined);
					stats.mediaTags.errors++;
				}
			}

			// Import media credits
			for (const mediaCredit of importData.mediaCredits) {
				try {
					const newMediaId = mediaIdMap.get(mediaCredit.media_id);
					const newPersonId = personIdMap.get(mediaCredit.person_id);
					
					if (!newMediaId || !newPersonId) {
						stats.mediaCredits.skipped++;
						continue;
					}
					
					const existing = db.prepare(
						'SELECT 1 FROM media_credit WHERE media_id = ? AND person_id = ?'
					).get(newMediaId, newPersonId);
					
					if (existing) {
						stats.mediaCredits.skipped++;
					} else {
						db.prepare(
							'INSERT INTO media_credit (media_id, person_id, created_at) VALUES (?, ?, ?)'
						).run(newMediaId, newPersonId, mediaCredit.created_at);
						
						stats.mediaCredits.added++;
					}
				} catch (error) {
					logger.error(`Failed to import media credit relationship`, error instanceof Error ? error : undefined);
					stats.mediaCredits.errors++;
				}
			}
		});

		// Execute the transaction
		importTransaction();

		logger.info(`Import completed: ${stats.libraries.added} libraries, ${stats.media.added} media items added`);

		return json({
			success: true,
			stats,
			message: 'Import completed successfully'
		}, { status: 201 });
	} catch (error) {
		logger.error('Failed to import data', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
