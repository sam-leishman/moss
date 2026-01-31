import { json, error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizeInteger, sanitizePersonName, sanitizePersonRole } from '$lib/server/security/sanitizer';
import { DuplicateEntryError, ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
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
		const { name, profile } = await request.json();

		const db = getDatabase();

		const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person | undefined;
		if (!person) {
			error(404, 'Person not found');
		}

		if (name) {
			const sanitizedName = sanitizePersonName(name);
			
			const existing = db.prepare('SELECT id FROM person WHERE name = ? AND id != ?').get(sanitizedName, personId);
			if (existing) {
				throw new DuplicateEntryError('Person', 'name', sanitizedName);
			}

			db.prepare('UPDATE person SET name = ?, updated_at = datetime("now") WHERE id = ?').run(sanitizedName, personId);
		}

		if (profile) {
			if (person.role === 'artist') {
				const style = profile.style || null;
				if (style) {
					const { sanitizeArtistStyle } = await import('$lib/server/security/sanitizer');
					const sanitizedStyle = sanitizeArtistStyle(style);
					
					const existingProfile = db.prepare('SELECT person_id FROM artist_profile WHERE person_id = ?').get(personId);
					if (existingProfile) {
						db.prepare('UPDATE artist_profile SET style = ?, updated_at = datetime("now") WHERE person_id = ?').run(sanitizedStyle, personId);
					} else {
						db.prepare('INSERT INTO artist_profile (person_id, style) VALUES (?, ?)').run(personId, sanitizedStyle);
					}
				}
			} else if (person.role === 'performer') {
				const age = profile.age;
				if (age !== undefined && age !== null) {
					const { sanitizeInteger } = await import('$lib/server/security/sanitizer');
					const sanitizedAge = sanitizeInteger(age, { min: 0 });
					
					const existingProfile = db.prepare('SELECT person_id FROM performer_profile WHERE person_id = ?').get(personId);
					if (existingProfile) {
						db.prepare('UPDATE performer_profile SET age = ?, updated_at = datetime("now") WHERE person_id = ?').run(sanitizedAge, personId);
					} else {
						db.prepare('INSERT INTO performer_profile (person_id, age) VALUES (?, ?)').run(personId, sanitizedAge);
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
