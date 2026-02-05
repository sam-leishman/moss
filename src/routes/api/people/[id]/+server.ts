import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger, sanitizePersonName, sanitizePersonRole } from '$lib/server/security/sanitizer';
import { DuplicateEntryError, ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { getPersonImageManager } from '$lib/server/images';
import type { Person, ArtistProfile, PerformerProfile } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:person');

export const GET: RequestHandler = async ({ params }) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person | undefined;

		if (!person) {
			error(404, 'Person not found');
		}

		let profile = null;
		if (person.role === 'artist') {
			profile = db.prepare('SELECT * FROM artist_profile WHERE person_id = ?').get(personId) as ArtistProfile | undefined;
		} else if (person.role === 'performer') {
			profile = db.prepare('SELECT * FROM performer_profile WHERE person_id = ?').get(personId) as PerformerProfile | undefined;
		}

		return json({ person, profile });
	} catch (err) {
		logger.error('Failed to fetch person', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const personId = sanitizeInteger(params.id);
		const { name, profile, is_global, library_id, force } = await request.json();

		const db = getDatabase();

		const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person | undefined;
		if (!person) {
			error(404, 'Person not found');
		}

		// Handle name and scope updates
		if (name !== undefined || is_global !== undefined || library_id !== undefined) {
			const sanitizedName = name ? sanitizePersonName(name) : person.name;
			const isGlobal = is_global !== undefined ? (is_global ? 1 : 0) : person.is_global;
			const newLibraryId = isGlobal ? null : (library_id !== undefined ? library_id : person.library_id);
			
			// Validate library_id requirement early
			if (!isGlobal && !newLibraryId) {
				throw new ValidationError('Library ID is required for library-specific people');
			}

			// Check if converting from global to library-specific
			if (person.is_global === 1 && isGlobal === 0) {
				// Check if person is used in other libraries (handle NULL properly)
				const otherLibraryUsage = db.prepare(`
					SELECT DISTINCT m.library_id, l.name as library_name, COUNT(*) as count
					FROM media_credit mc
					JOIN media m ON mc.media_id = m.id
					JOIN library l ON m.library_id = l.id
					WHERE mc.person_id = ? AND (? IS NULL OR m.library_id != ?)
					GROUP BY m.library_id, l.name
				`).all(personId, newLibraryId, newLibraryId) as Array<{ library_id: number; library_name: string; count: number }>;

				if (otherLibraryUsage.length > 0 && !force) {
					const totalItems = otherLibraryUsage.reduce((sum, lib) => sum + lib.count, 0);
					return json({
						error: 'cross_library_usage',
						message: 'This person is currently credited in other libraries',
						usage: otherLibraryUsage,
						totalItems,
						personId
					}, { status: 409 });
				}

				// If force is true, remove person credits from media in other libraries (in transaction)
				if (force) {
					const updateTransaction = db.transaction(() => {
						const deleteResult = db.prepare(`
							DELETE FROM media_credit
							WHERE person_id = ? AND media_id IN (
								SELECT id FROM media WHERE library_id != ?
							)
						`).run(personId, newLibraryId);

						const totalItems = otherLibraryUsage.reduce((sum, lib) => sum + lib.count, 0);
						logger.info(`Removed person ${personId} from ${totalItems} item(s) across ${otherLibraryUsage.length} other library/libraries (forced)`);

						// Update person in same transaction
						const existing = db.prepare(
							'SELECT id FROM person WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL)) AND id != ?'
						).get(sanitizedName, newLibraryId, newLibraryId, personId);
						if (existing) {
							const scope = isGlobal ? 'global' : 'this library';
							throw new DuplicateEntryError('Person', 'name', `${sanitizedName} (already exists in ${scope})`);
						}

						db.prepare(
							'UPDATE person SET name = ?, library_id = ?, is_global = ?, updated_at = datetime(\'now\') WHERE id = ?'
						).run(sanitizedName, newLibraryId, isGlobal, personId);
					});

					updateTransaction();
				} else {
					// No force update, just check for duplicates and update
					const existing = db.prepare(
						'SELECT id FROM person WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL)) AND id != ?'
					).get(sanitizedName, newLibraryId, newLibraryId, personId);
					if (existing) {
						const scope = isGlobal ? 'global' : 'this library';
						throw new DuplicateEntryError('Person', 'name', `${sanitizedName} (already exists in ${scope})`);
					}

					db.prepare(
						'UPDATE person SET name = ?, library_id = ?, is_global = ?, updated_at = datetime(\'now\') WHERE id = ?'
					).run(sanitizedName, newLibraryId, isGlobal, personId);
				}
			} else {
				// Not converting from global to library-specific, just update
				const existing = db.prepare(
					'SELECT id FROM person WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL)) AND id != ?'
				).get(sanitizedName, newLibraryId, newLibraryId, personId);
				if (existing) {
					const scope = isGlobal ? 'global' : 'this library';
					throw new DuplicateEntryError('Person', 'name', `${sanitizedName} (already exists in ${scope})`);
				}

				db.prepare(
					'UPDATE person SET name = ?, library_id = ?, is_global = ?, updated_at = datetime(\'now\') WHERE id = ?'
				).run(sanitizedName, newLibraryId, isGlobal, personId);
			}
		}

		if (profile) {
			if (person.role === 'artist') {
				const style = profile.style || null;
				if (style) {
					const { sanitizeArtistStyle } = await import('$lib/server/security/sanitizer');
					const sanitizedStyle = sanitizeArtistStyle(style);
					
					const existingProfile = db.prepare('SELECT person_id FROM artist_profile WHERE person_id = ?').get(personId);
					if (existingProfile) {
						db.prepare('UPDATE artist_profile SET style = ?, updated_at = datetime(\'now\') WHERE person_id = ?').run(sanitizedStyle, personId);
					} else {
						db.prepare('INSERT INTO artist_profile (person_id, style) VALUES (?, ?)').run(personId, sanitizedStyle);
					}
				}
			} else if (person.role === 'performer') {
				const birthday = profile.birthday;
				const gender = profile.gender;
				
				let sanitizedBirthday = null;
				let sanitizedGender = null;
				
				if (birthday !== undefined && birthday !== null) {
					const { sanitizeBirthday } = await import('$lib/server/security/sanitizer');
					sanitizedBirthday = sanitizeBirthday(birthday);
				}
				
				if (gender !== undefined && gender !== null) {
					const { sanitizeGender } = await import('$lib/server/security/sanitizer');
					sanitizedGender = sanitizeGender(gender);
				}
				
				if (birthday !== undefined || gender !== undefined) {
					const existingProfile = db.prepare('SELECT person_id FROM performer_profile WHERE person_id = ?').get(personId);
					if (existingProfile) {
						if (birthday !== undefined && gender !== undefined) {
							db.prepare('UPDATE performer_profile SET birthday = ?, gender = ?, updated_at = datetime(\'now\') WHERE person_id = ?').run(sanitizedBirthday, sanitizedGender, personId);
						} else if (birthday !== undefined) {
							db.prepare('UPDATE performer_profile SET birthday = ?, updated_at = datetime(\'now\') WHERE person_id = ?').run(sanitizedBirthday, personId);
						} else if (gender !== undefined) {
							db.prepare('UPDATE performer_profile SET gender = ?, updated_at = datetime(\'now\') WHERE person_id = ?').run(sanitizedGender, personId);
						}
					} else {
						// Create profile first with empty values, then update only the provided fields
						db.prepare('INSERT INTO performer_profile (person_id) VALUES (?)').run(personId);
						if (birthday !== undefined) {
							db.prepare('UPDATE performer_profile SET birthday = ?, updated_at = datetime(\'now\') WHERE person_id = ?').run(sanitizedBirthday, personId);
						}
						if (gender !== undefined) {
							db.prepare('UPDATE performer_profile SET gender = ?, updated_at = datetime(\'now\') WHERE person_id = ?').run(sanitizedGender, personId);
						}
					}
				}
			}
		}

		const updatedPerson = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person;

		logger.info(`Person updated: ${updatedPerson.name}`);

		return json({ person: updatedPerson });
	} catch (err) {
		logger.error('Failed to update person', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const personId = sanitizeInteger(params.id);
		const db = getDatabase();

		const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person | undefined;
		if (!person) {
			error(404, 'Person not found');
		}

		if (person.image_path) {
			const imageManager = getPersonImageManager();
			await imageManager.deletePersonImage(personId);
		}

		const result = db.prepare('DELETE FROM person WHERE id = ?').run(personId);

		if (result.changes === 0) {
			error(404, 'Person not found');
		}

		logger.info(`Person deleted: ${person.name}`);

		return json({ success: true });
	} catch (err) {
		logger.error('Failed to delete person', err instanceof Error ? err : undefined);
		return handleError(err);
	}
};
