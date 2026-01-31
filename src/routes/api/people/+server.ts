import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizePersonName, sanitizePersonRole } from '$lib/server/security/sanitizer';
import { DuplicateEntryError, ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import type { Person } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:people');

export const GET: RequestHandler = async ({ url }) => {
	try {
		const db = getDatabase();
		const role = url.searchParams.get('role');
		
		let query = 'SELECT * FROM person';
		const params: string[] = [];
		
		if (role) {
			const sanitizedRole = sanitizePersonRole(role);
			query += ' WHERE role = ?';
			params.push(sanitizedRole);
		}
		
		query += ' ORDER BY name ASC';
		
		const people = db.prepare(query).all(...params) as Person[];
		
		return json(people);
	} catch (error) {
		logger.error('Failed to fetch people', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name, role, profile } = await request.json();

		if (!name) {
			throw new ValidationError('Person name is required');
		}

		if (!role) {
			throw new ValidationError('Person role is required');
		}

		const sanitizedName = sanitizePersonName(name);
		const sanitizedRole = sanitizePersonRole(role);

		const db = getDatabase();
		
		const existing = db.prepare('SELECT id FROM person WHERE name = ?').get(sanitizedName);
		if (existing) {
			throw new DuplicateEntryError('Person', 'name', sanitizedName);
		}

		const result = db.prepare('INSERT INTO person (name, role) VALUES (?, ?)').run(sanitizedName, sanitizedRole);
		const personId = result.lastInsertRowid;

		if (sanitizedRole === 'artist' && profile) {
			const style = profile.style || null;
			if (style) {
				const { sanitizeArtistStyle } = await import('$lib/server/security/sanitizer');
				const sanitizedStyle = sanitizeArtistStyle(style);
				db.prepare('INSERT INTO artist_profile (person_id, style) VALUES (?, ?)').run(personId, sanitizedStyle);
			} else {
				db.prepare('INSERT INTO artist_profile (person_id) VALUES (?)').run(personId);
			}
		} else if (sanitizedRole === 'performer' && profile) {
			const age = profile.age || null;
			if (age !== null) {
				const { sanitizeInteger } = await import('$lib/server/security/sanitizer');
				const sanitizedAge = sanitizeInteger(age, { min: 0 });
				db.prepare('INSERT INTO performer_profile (person_id, age) VALUES (?, ?)').run(personId, sanitizedAge);
			} else {
				db.prepare('INSERT INTO performer_profile (person_id) VALUES (?)').run(personId);
			}
		}

		const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person;

		logger.info(`Person created: ${sanitizedName} (${sanitizedRole})`);
		
		return json({ person }, { status: 201 });
	} catch (error) {
		logger.error('Failed to create person', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
