# XView User Authentication & Authorization Implementation Plan

**Version:** 1.0  
**Date:** February 3, 2026  
**Status:** Planning Phase

---

## Executive Summary

This document provides a comprehensive plan for implementing user authentication and authorization in XView, a self-hosted media library management system. The implementation follows industry best practices for SvelteKit 5 and SQLite, inspired by proven self-hosted applications like Jellyfin and Audiobookshelf.

### Key Requirements
- **Two-tier user system**: Admin (full access) and User (view-only with library permissions)
- **Username/password authentication**: Simple, self-hosted friendly approach
- **Library-level permissions**: Admins control which users can access which libraries
- **Session management**: Secure, persistent sessions with "Remember Me" functionality
- **Migration strategy**: Create default admin user, preserve all existing data

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema Changes](#2-database-schema-changes)
3. [Authentication System](#3-authentication-system)
4. [Authorization & Permissions](#4-authorization--permissions)
5. [API Endpoint Security](#5-api-endpoint-security)
6. [Frontend Changes](#6-frontend-changes)
7. [Migration Strategy](#7-migration-strategy)
8. [Breaking Changes Analysis](#8-breaking-changes-analysis)
9. [Implementation Phases](#9-implementation-phases)
10. [Testing Strategy](#10-testing-strategy)
11. [Security Considerations](#11-security-considerations)

---

## 1. Architecture Overview

### 1.1 Authentication Flow

```
User Login → Validate Credentials → Create Session → Set HTTP-Only Cookie
     ↓
Every Request → Validate Session (hooks.server.ts) → Load User → Check Permissions
     ↓
Protected Route/API → Access Granted (if authorized)
```

### 1.2 Technology Stack

- **Password Hashing**: Argon2id (via `@node-rs/argon2`)
- **Session Storage**: SQLite database
- **Session Tokens**: Cryptographically secure random tokens (32 bytes)
- **Cookie Management**: SvelteKit's built-in cookie handling
- **Authorization**: Role-based access control (RBAC) with library-level permissions

### 1.3 Design Principles

1. **Self-hosted first**: No external dependencies, works offline
2. **Simple but secure**: Username/password with proper hashing
3. **Minimal friction**: Long-lived sessions with "Remember Me"
4. **Graceful degradation**: Clear error messages, no data loss
5. **Docker-friendly**: Works seamlessly in containerized environments

---

## 2. Database Schema Changes

### 2.1 New Tables

#### Users Table
```sql
CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Sessions Table
```sql
CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_agent TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session(expires_at);
```

#### Library Permissions Table
```sql
CREATE TABLE IF NOT EXISTS library_permission (
    user_id INTEGER NOT NULL,
    library_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, library_id),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    FOREIGN KEY (library_id) REFERENCES library(id) ON DELETE CASCADE
);
```

**Note**: Admins have implicit access to all libraries.

### 2.2 Migration Script (Version 5)

Location: `src/lib/server/db/migrations.ts`

The migration will:
1. Create user, session, and library_permission tables
2. Create appropriate indexes
3. Insert default admin user (username: `admin`, password: `admin`)
4. Update schema version to 5

Default admin password MUST be changed after first login.

### 2.3 TypeScript Types

Add to `src/lib/server/db/types.ts`:

```typescript
export interface User {
    id: number;
    username: string;
    password_hash: string;
    role: 'admin' | 'user';
    is_active: number;
    created_at: string;
    updated_at: string;
}

export interface Session {
    id: string;
    user_id: number;
    expires_at: string;
    created_at: string;
    last_used_at: string;
    user_agent: string | null;
    ip_address: string | null;
}

export interface LibraryPermission {
    user_id: number;
    library_id: number;
    created_at: string;
}
```

---

## 3. Authentication System

### 3.1 Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "@node-rs/argon2": "^1.8.0"
  }
}
```

### 3.2 Password Utilities

**File**: `src/lib/server/auth/password.ts`

Functions:
- `hashPassword(password: string): Promise<string>` - Hash password with Argon2id
- `verifyPassword(hash: string, password: string): Promise<boolean>` - Verify password
- `validatePassword(password: string)` - Validate password requirements (8-128 chars)
- `validateUsername(username: string)` - Validate username (3-50 chars, alphanumeric + _ -)

### 3.3 Session Management

**File**: `src/lib/server/auth/session.ts`

Functions:
- `generateSessionToken(): string` - Generate secure random token
- `createSession(db, userId, rememberMe, userAgent, ipAddress): Session` - Create new session
- `validateSession(db, sessionId): { session, user } | null` - Validate and return session
- `deleteSession(db, sessionId): void` - Delete session
- `deleteAllUserSessions(db, userId): void` - Delete all user sessions
- `cleanupExpiredSessions(db): number` - Remove expired sessions

Session durations:
- Standard: 30 days
- Remember Me: 365 days

### 3.4 Authentication API Endpoints

#### POST /api/auth/login
- Validates credentials
- Creates session
- Sets HTTP-only cookie
- Returns user data

#### POST /api/auth/logout
- Deletes session
- Clears cookie

#### GET /api/auth/me
- Returns current user data
- Requires authentication

#### POST /api/auth/change-password
- Allows users to change their own password
- Requires current password verification
- Validates new password requirements
- Invalidates all other sessions (security best practice)

### 3.5 Server Hooks Integration

**File**: `src/hooks.server.ts` (MODIFIED)

Add session validation to `handle` function:
1. Read session cookie
2. Validate session
3. Load user into `event.locals.user`
4. Clear cookie if invalid

Add periodic session cleanup using `setInterval`:
```typescript
const startSessionCleanupJob = () => {
    const runCleanup = () => {
        try {
            const db = getDatabase();
            const deletedCount = cleanupExpiredSessions(db);
            if (deletedCount > 0) {
                logger.info(`Session cleanup: removed ${deletedCount} expired sessions`);
            }
        } catch (error) {
            logger.error('Session cleanup failed', error);
        }
    };
    
    // Run cleanup on startup
    runCleanup();
    
    // Run cleanup hourly
    setInterval(runCleanup, 60 * 60 * 1000);
};

startSessionCleanupJob();
```

### 3.6 App Locals Type Definition

**File**: `src/app.d.ts` (MODIFIED)

```typescript
import type { User, Session } from '$lib/server/db';

declare global {
    namespace App {
        interface Locals {
            user?: User;
            session?: Session;
        }
    }
}
```

---

## 4. Authorization & Permissions

### 4.1 Permission Utilities

**File**: `src/lib/server/auth/permissions.ts`

Functions:
- `isAdmin(user): boolean` - Check if user is admin
- `canAccessLibrary(db, user, libraryId): boolean` - Check library access
- `getUserLibraries(db, user): number[]` - Get accessible library IDs
- `grantLibraryAccess(db, userId, libraryId): void` - Grant access
- `revokeLibraryAccess(db, userId, libraryId): void` - Revoke access
- `setUserLibraries(db, userId, libraryIds): void` - Set all permissions

### 4.2 Authorization Middleware

**File**: `src/lib/server/auth/middleware.ts`

Functions:
- `requireAuth(event): User` - Require authentication (throws 401 if not logged in)
- `requireAdmin(event): User` - Require admin role (throws 403 if not admin)
- `requireLibraryAccess(event, libraryId): User` - Require library access
- `filterLibrariesByAccess(event, libraries)` - Filter libraries by user permissions

---

## 5. API Endpoint Security

### 5.1 Endpoint Classification

#### Public Endpoints (No Auth)
- `POST /api/auth/login`

#### Authenticated Endpoints (Any User)
- All GET endpoints (filtered by library access)
- Media streaming and thumbnails (with library access check)

#### Admin-Only Endpoints
- All POST, PATCH, DELETE endpoints
- Library management (create, update, delete, scan, cleanup, relocate)
- Media management (create, update, delete, bulk edit)
- Tag/People management (create, update, delete)
- Backup/restore operations
- Import/export operations
- User management (new)

### 5.2 Implementation Pattern

All API endpoints must be updated to:
1. Import auth middleware
2. Call appropriate auth function (`requireAuth`, `requireAdmin`, `requireLibraryAccess`)
3. Filter results by library access for GET endpoints
4. Log actions with username

Example:
```typescript
export const GET = async ({ locals }) => {
    requireAuth({ locals } as any);
    const db = getDatabase();
    const allLibraries = db.prepare('SELECT * FROM library').all();
    const libraries = filterLibrariesByAccess({ locals } as any, allLibraries);
    return json({ libraries });
};
```

### 5.3 Critical Endpoints to Protect

**High Priority**:
- `/api/media/[id]/file` - Media file streaming (check library access)
- `/api/media/[id]/thumbnail` - Thumbnail access (check library access)
- `/api/libraries/*` - All library operations
- `/api/backup/*` - Backup operations (admin only)

**Medium Priority**:
- All media CRUD operations
- Tag/people management
- Import/export operations

---

## 6. Frontend Changes

### 6.1 Authentication State Management

**File**: `src/lib/stores/auth.svelte.ts`

Svelte 5 runes-based store:
```typescript
class AuthStore {
    user = $state<AuthUser | null>(null);
    loading = $state(true);
    
    async init() { /* Load current user */ }
    async login(username, password, rememberMe) { /* Login */ }
    async logout() { /* Logout and redirect */ }
    
    get isAuthenticated() { return this.user !== null; }
    get isAdmin() { return this.user?.role === 'admin'; }
}
```

### 6.2 Login Page

**File**: `src/routes/login/+page.svelte` (NEW)

Features:
- Username/password form
- "Remember me" checkbox
- Error display
- Default credentials hint
- Auto-redirect if already logged in

### 6.3 Root Layout Authentication

**File**: `src/routes/+layout.svelte` (MODIFIED)

Changes:
- Initialize auth store on mount
- Redirect to /login if not authenticated
- Show loading state during auth check
- Add logout button to header
- Display username and role badge
- Skip auth check for /login page

### 6.4 User Management UI (Admin Only)

**File**: `src/routes/settings/users/+page.svelte` (NEW)

Features:
- List all users
- Create new user
- Edit user (username, role, active status)
- Change user password
- Assign library permissions
- View/manage active sessions
- Delete user (with confirmation)

This requires new API endpoints:
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PATCH /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user
- `POST /api/users/[id]/password` - Change user password (admin only)
- `GET /api/users/[id]/permissions` - Get library permissions
- `PUT /api/users/[id]/permissions` - Set library permissions
- `GET /api/users/[id]/sessions` - List user sessions
- `DELETE /api/users/[id]/sessions/[sessionId]` - Revoke session

---

## 7. Migration Strategy

### 7.1 Pre-Migration Checklist

- [ ] Create database backup
- [ ] Test migration in development environment
- [ ] Document default credentials
- [ ] Prepare rollback plan
- [ ] Notify users of upcoming changes

### 7.2 Migration Steps

1. **Stop application**
2. **Backup database** (`/config/xview.db`)
3. **Update application** to new version
4. **Start application** (migration runs automatically)
5. **Verify migration** (check logs for "Migration 5 completed")
6. **Test login** with default credentials (admin/admin)
7. **Change admin password** immediately
8. **Create additional users** as needed

### 7.3 Default Admin Credentials

**Username**: `admin`  
**Password**: `admin`

**CRITICAL**: Change this password immediately after first login!

### 7.4 Data Preservation

All existing data is preserved:
- ✅ All libraries
- ✅ All media entries
- ✅ All tags and people
- ✅ All relationships
- ✅ All thumbnails

Only addition: Authentication layer

### 7.5 Rollback Procedure

If issues occur:
1. Stop application
2. Restore database backup
3. Downgrade to previous application version
4. Restart application

The migration includes a `down()` function for clean rollback.

---

## 8. Breaking Changes Analysis

### 8.1 API Breaking Changes

**ALL API endpoints now require authentication** (except `/api/auth/login`).

**Impact**:
- External scripts/tools must authenticate first
- Must include session cookie in requests
- Must handle 401/403 responses

**Mitigation**:
- Document API authentication
- Provide example scripts
- Consider API tokens in future (optional enhancement)

### 8.2 Frontend Breaking Changes

**All routes require authentication** (except `/login`).

**Impact**:
- Users redirected to login on first visit after upgrade
- Existing sessions invalid
- Must use default credentials initially

**Mitigation**:
- Clear messaging on login page
- Password change prompt after first login
- Comprehensive upgrade documentation

### 8.3 Docker Deployment

**No breaking changes to Docker setup**.

Works with existing configuration:
- Database in `/config` volume (persistent)
- No new environment variables
- No new ports

### 8.4 Backward Compatibility

**This is a breaking change** - no backward compatibility with unauthenticated access.

However:
- ✅ All data preserved
- ✅ Migration reversible
- ✅ Clear upgrade path
- ✅ Documented process

---

## 9. Implementation Phases

### Phase 1: Database & Core Auth (3-4 days)
- Add dependencies
- Create migration
- Implement password/session utilities
- Create auth API endpoints
- Update hooks.server.ts

### Phase 2: Authorization & API Protection (3-4 days)
- Implement permission utilities
- Create authorization middleware
- Update all API endpoints
- Test library access filtering

### Phase 3: Frontend Authentication (2-3 days)
- Create auth store
- Create login page
- Update root layout
- Add logout functionality

### Phase 4: User Management (3-4 days)
- Create user management API
- Create user management UI
- Implement library permission assignment
- Implement password management

### Phase 5: Testing & Documentation (2-3 days)
- Comprehensive testing
- Security audit
- Update documentation
- Prepare deployment guide

**Total Estimated Time**: 2-3 weeks

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Password Utilities**:
- Hash generation
- Password verification
- Validation rules

**Session Management**:
- Token generation
- Session creation
- Session validation
- Expiration handling

**Permissions**:
- Admin checks
- Library access checks
- Permission granting/revoking

### 10.2 Integration Tests

**Authentication Flow**:
- Login with valid credentials
- Login with invalid credentials
- Session validation
- Logout

**Authorization**:
- Admin access to all libraries
- User access to permitted libraries only
- Admin-only endpoint protection
- Library access filtering

### 10.3 End-to-End Tests

Using Playwright:
- Complete login/logout flow
- Library access as different users
- User management operations
- Permission assignment

### 10.4 Security Tests

- Password hashing strength
- Session token randomness
- SQL injection prevention
- XSS prevention
- CSRF protection (via SvelteKit)

---

## 11. Security Considerations

### 11.1 Password Security

**Algorithm**: Argon2id
- Memory cost: 19 MiB
- Time cost: 2 iterations
- Parallelism: 1 thread

**Requirements**:
- Minimum 8 characters
- Maximum 128 characters
- No complexity requirements (length is sufficient)

### 11.2 Session Security

**Token Generation**:
- 32 bytes cryptographically secure random
- 64 character hex string

**Cookie Settings**:
- HttpOnly: true (prevents XSS)
- SameSite: lax (prevents CSRF)
- Secure: true in production (HTTPS only)
- Path: / (application-wide)

**Session Duration**:
- Standard: 30 days
- Remember Me: 365 days
- Automatic cleanup of expired sessions

### 11.3 Rate Limiting

Existing rate limiting infrastructure can be enhanced:
- Login endpoint: 5 attempts per minute per IP
- Password change: 3 attempts per hour per user

### 11.4 Audit Logging

Log all security-relevant events:
- Login attempts (success/failure)
- Logout events
- Password changes
- User creation/deletion
- Permission changes
- Admin actions

### 11.5 Self-Hosted Security Considerations

For self-hosted environments:
- No external authentication providers needed
- Works behind firewall/VPN
- No telemetry or external calls
- Full data sovereignty
- Recommend HTTPS with reverse proxy (Nginx, Caddy, Traefik)

---

## 12. Files to Create/Modify

### New Files (17)

**Backend**:
1. `src/lib/server/auth/password.ts`
2. `src/lib/server/auth/session.ts`
3. `src/lib/server/auth/permissions.ts`
4. `src/lib/server/auth/middleware.ts`
5. `src/lib/server/auth/index.ts` (exports)
6. `src/routes/api/auth/login/+server.ts`
7. `src/routes/api/auth/logout/+server.ts`
8. `src/routes/api/auth/me/+server.ts`
9. `src/routes/api/auth/change-password/+server.ts`
10. `src/routes/api/users/+server.ts`
11. `src/routes/api/users/[id]/+server.ts`
12. `src/routes/api/users/[id]/password/+server.ts`
13. `src/routes/api/users/[id]/permissions/+server.ts`
14. `src/routes/api/users/[id]/sessions/+server.ts`

**Frontend**:
15. `src/lib/stores/auth.svelte.ts`
16. `src/routes/login/+page.svelte`
17. `src/routes/settings/users/+page.svelte`
18. `src/routes/settings/users/+page.ts`

### Modified Files (35+)

**Core**:
1. `package.json` (add @node-rs/argon2)
2. `src/app.d.ts` (add Locals interface)
3. `src/hooks.server.ts` (add session validation)
4. `src/lib/server/db/migrations.ts` (add migration 5)
5. `src/lib/server/db/schema.ts` (update SCHEMA_VERSION)
6. `src/lib/server/db/types.ts` (add User, Session, LibraryPermission)
7. `src/lib/server/db/index.ts` (export new types)
8. `src/routes/+layout.svelte` (add auth check)

**API Endpoints** (all 32 existing endpoints):
- Add authentication/authorization checks
- Filter results by library access
- Log actions with username

---

## 13. Post-Implementation Tasks

### 13.1 Documentation Updates

- [ ] Update README with authentication info
- [ ] Create user guide for admins
- [ ] Document API authentication
- [ ] Update Docker documentation
- [ ] Create migration guide

### 13.2 User Communication

- [ ] Announce authentication feature
- [ ] Provide upgrade instructions
- [ ] Share default credentials securely
- [ ] Offer support for migration issues

### 13.3 Future Enhancements

**Optional features to consider**:
- API tokens for programmatic access
- Two-factor authentication (TOTP)
- Password reset via email (if SMTP configured)
- User activity logging/audit trail
- Session management UI for users
- Configurable session durations
- Account lockout after failed attempts
- Password expiration policies

---

## 14. Success Criteria

The implementation is successful when:

- ✅ All existing data is preserved
- ✅ Default admin user can log in
- ✅ Admin can create new users
- ✅ Admin can assign library permissions
- ✅ Users can only access permitted libraries
- ✅ All API endpoints are protected
- ✅ Sessions persist across browser restarts (with Remember Me)
- ✅ Logout works correctly
- ✅ No security vulnerabilities
- ✅ Performance is not degraded
- ✅ Docker deployment works seamlessly
- ✅ Documentation is complete

---

## 15. Risk Assessment

### High Risk
- **Data loss during migration**: Mitigated by backup requirement and tested migration
- **Lockout from system**: Mitigated by default admin account and documented recovery

### Medium Risk
- **Performance impact**: Mitigated by indexed queries and efficient session validation
- **Breaking external integrations**: Mitigated by documentation and API examples

### Low Risk
- **User confusion**: Mitigated by clear UI and documentation
- **Session management issues**: Mitigated by comprehensive testing

---

## 16. Conclusion

This plan provides a comprehensive, production-ready approach to adding user authentication and authorization to XView. The implementation follows industry best practices, maintains backward compatibility for data, and provides a clear path from planning through deployment.

The system is designed specifically for self-hosted environments, with no external dependencies, offline operation, and Docker-friendly architecture. The two-tier user system (Admin/User) with library-level permissions matches the requirements and follows patterns established by similar applications like Jellyfin and Audiobookshelf.

**Next Steps**:
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Conduct thorough testing at each phase
4. Deploy to production with proper backups
5. Monitor and support users through migration

---

**Document Version**: 1.0  
**Last Updated**: February 3, 2026  
**Status**: Ready for Implementation
