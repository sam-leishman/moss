import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import { sanitizePersonName, sanitizePersonRole } from '$lib/server/security/sanitizer';
import { DuplicateEntryError, ValidationError, handleError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';
import { requireAuth, requireAdmin, getUserLibraries, isAdmin } from '$lib/server/auth';
import type { Person } from '$lib/server/db';
import type { RequestHandler } from './$types';

const logger = getLogger('api:people');

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const user = requireAuth(locals);
		const db = getDatabase();
		const role = url.searchParams.get('role');
		const libraryId = url.searchParams.get('library_id');
		
		let query = 'SELECT * FROM person';
		const params: (string | number)[] = [];
		const conditions: string[] = [];
		
		if (role) {
			const sanitizedRole = sanitizePersonRole(role);
			conditions.push('role = ?');
			params.push(sanitizedRole);
		}
		
		if (libraryId) {
			// Get library-specific people and global people
			conditions.push('(library_id = ? OR is_global = 1)');
			params.push(parseInt(libraryId, 10));
		} else if (!isAdmin(user)) {
			// Non-admin users: only show people from their accessible libraries
			const accessibleLibraries = getUserLibraries(db, user);
			if (accessibleLibraries.length === 0) {
				return json([]);
			}
			const placeholders = accessibleLibraries.map(() => '?').join(',');
			conditions.push(`(library_id IN (${placeholders}) OR is_global = 1)`);
			params.push(...accessibleLibraries);
		}
		
		if (conditions.length > 0) {
			query += ' WHERE ' + conditions.join(' AND ');
		}
		
		query += ' ORDER BY is_global DESC, name ASC';
		
		const people = db.prepare(query).all(...params) as Person[];
		
		return json(people);
	} catch (error) {
		logger.error('Failed to fetch people', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = requireAdmin(locals);
		const { name, role, profile, library_id, is_global } = await request.json();

		if (!name) {
			throw new ValidationError('Person name is required');
		}

		if (!role) {
			throw new ValidationError('Person role is required');
		}

		const sanitizedName = sanitizePersonName(name);
		const sanitizedRole = sanitizePersonRole(role);
		const isGlobal = is_global ? 1 : 0;
		const libraryId = isGlobal ? null : library_id;

		if (!isGlobal && !libraryId) {
			throw new ValidationError('Library ID is required for library-specific people');
		}

		const db = getDatabase();
		
		// Check for duplicate: same name and library_id combination
		const existing = db.prepare(
			'SELECT id FROM person WHERE name = ? AND (library_id IS ? OR (library_id IS NULL AND ? IS NULL))'
		).get(sanitizedName, libraryId, libraryId);
		if (existing) {
			const scope = isGlobal ? 'global' : 'this library';
			throw new DuplicateEntryError('Person', 'name', `${sanitizedName} (already exists in ${scope})`);
		}

		const result = db.prepare(
			'INSERT INTO person (name, role, library_id, is_global) VALUES (?, ?, ?, ?)'
		).run(sanitizedName, sanitizedRole, libraryId, isGlobal);
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
			const birthday = profile.birthday || null;
			const gender = profile.gender || null;
			
			let sanitizedBirthday = null;
			let sanitizedGender = null;
			
			if (birthday) {
				const { sanitizeBirthday } = await import('$lib/server/security/sanitizer');
				sanitizedBirthday = sanitizeBirthday(birthday);
			}
			
			if (gender) {
				const { sanitizeGender } = await import('$lib/server/security/sanitizer');
				sanitizedGender = sanitizeGender(gender);
			}
			
			// Create profile first, then update only the provided fields
			db.prepare('INSERT INTO performer_profile (person_id) VALUES (?)').run(personId);
			if (birthday) {
				db.prepare('UPDATE performer_profile SET birthday = ?, updated_at = datetime(\'now\') WHERE person_id = ?').run(sanitizedBirthday, personId);
			}
			if (gender) {
				db.prepare('UPDATE performer_profile SET gender = ?, updated_at = datetime(\'now\') WHERE person_id = ?').run(sanitizedGender, personId);
			}
		}

		const person = db.prepare('SELECT * FROM person WHERE id = ?').get(personId) as Person;

		const scope = isGlobal ? 'global' : `library ${libraryId}`;
		logger.info(`Person created by ${user.username}: ${sanitizedName} (${sanitizedRole}, ${scope})`);
		
		return json({ person }, { status: 201 });
	} catch (error) {
		logger.error('Failed to create person', error instanceof Error ? error : undefined);
		return handleError(error);
	}
};
