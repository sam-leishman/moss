import type Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import type { Session, User } from '$lib/server/db';

const SESSION_DURATION_DAYS = 30;
const REMEMBER_ME_DURATION_DAYS = 365;

export function generateSessionToken(): string {
	return randomBytes(32).toString('hex');
}

export function createSession(
	db: Database.Database,
	userId: number,
	rememberMe: boolean = false,
	userAgent: string | null = null,
	ipAddress: string | null = null
): Session {
	const sessionId = generateSessionToken();
	const durationDays = rememberMe ? REMEMBER_ME_DURATION_DAYS : SESSION_DURATION_DAYS;
	const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
	
	const stmt = db.prepare(`
		INSERT INTO session (id, user_id, expires_at, user_agent, ip_address)
		VALUES (?, ?, ?, ?, ?)
	`);
	
	stmt.run(sessionId, userId, expiresAt, userAgent, ipAddress);
	
	return db.prepare('SELECT * FROM session WHERE id = ?').get(sessionId) as Session;
}

export function validateSession(
	db: Database.Database,
	sessionId: string
): { session: Session; user: User } | null {
	const transaction = db.transaction(() => {
		const session = db.prepare('SELECT * FROM session WHERE id = ?').get(sessionId) as Session | undefined;
		
		if (!session) {
			return null;
		}
		
		if (new Date(session.expires_at) < new Date()) {
			db.prepare('DELETE FROM session WHERE id = ?').run(sessionId);
			return null;
		}
		
		const user = db.prepare('SELECT * FROM user WHERE id = ?').get(session.user_id) as User | undefined;
		
		if (!user || !user.is_active) {
			db.prepare('DELETE FROM session WHERE id = ?').run(sessionId);
			return null;
		}
		
		db.prepare('UPDATE session SET last_used_at = datetime(\'now\') WHERE id = ?').run(sessionId);
		
		return { session, user };
	});
	
	return transaction();
}

export function deleteSession(db: Database.Database, sessionId: string): void {
	db.prepare('DELETE FROM session WHERE id = ?').run(sessionId);
}

export function deleteAllUserSessions(db: Database.Database, userId: number): void {
	db.prepare('DELETE FROM session WHERE user_id = ?').run(userId);
}

export function cleanupExpiredSessions(db: Database.Database): number {
	const result = db.prepare('DELETE FROM session WHERE expires_at < datetime(\'now\')').run();
	return result.changes;
}
