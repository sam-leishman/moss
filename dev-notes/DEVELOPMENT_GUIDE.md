# Moss Development Guide

## Core Philosophy

**What Moss Is:**
A media library manager for NAS deployments. Users create libraries pointing to folders, the app scans for media files, and provides tagging and credit attribution.

**Fundamental Principles:**
- **Read-only source files** - Never modify original media in `/media`, all metadata stored in separate SQLite database
- **Single-user NAS deployment** - Optimized for personal use, not multi-tenant
- **Docker-first** - Designed to run in containers with volume mounts (`/media`, `/config`, `/metadata`)
- **Dark mode everywhere** - Not optional, every UI element must support light and dark themes

---

## Critical Constraints

These are unchanging rules enforced by the architecture:

1. **Library folders MUST be within `/media` mount** - Path validator enforces this
2. **Person roles are immutable** - Cannot change role after creation (artist vs performer)
3. **Media paths are unique** - Same file cannot exist in multiple libraries
4. **Source files are read-only** - `/media` volume is mounted read-only
5. **Icons must be Lucide** - No other icon libraries allowed
6. **Dark mode is mandatory** - Every component must have `dark:` variants
7. **Database is SQLite** - Single file at `/config/moss.db`
8. **Migrations run automatically** - On server startup via `hooks.server.ts`

---

## Key Architectural Decisions

**Why SQLite over PostgreSQL:**
- Simplicity for single-user NAS deployment
- No separate database server to manage
- Easy backup (single file)
- Sufficient performance for personal media libraries

**Why read-only media volume:**
- Prevents accidental modification of source files
- All metadata stored separately in database
- Clear separation of concerns (source vs metadata)

**Why path-based library membership:**
- No junction table needed
- Library determined by folder path prefix matching
- Simpler queries and data model

**Why fixed person roles:**
- Maintains data model consistency
- Prevents profile confusion (artist vs performer attributes)
- Clearer user experience

**Why global vs library-specific entities:**
- Flexibility for shared metadata (global tags/people)
- Isolation when needed (library-specific tags/people)
- Uniqueness constraint: `UNIQUE(name, library_id)` allows same name in different contexts

---

## Development Workflow

### Database Migrations
1. Read current schema in `src/lib/server/db/schema.ts`
2. Increment `SCHEMA_VERSION` constant
3. Add migration to `migrations` array in `src/lib/server/db/migrations.ts`
4. Implement `up()` function (and optionally `down()` for rollback)
5. Test migration on development database copy
6. Migrations run automatically on next server start

### Testing Changes
- **Always test both themes** - Light and dark mode
- **Test with real data** - Create test libraries with actual media files
- **Test error cases** - Invalid paths, missing files, permission issues
- **Test migrations** - On a copy of the database, never production directly

### Finding Patterns
- **API endpoints:** `find src/routes/api -name "+server.ts"`
- **Components:** `find src/lib/components -name "*.svelte"`
- **Database schema:** `src/lib/server/db/schema.ts`
- **Styling patterns:** `STYLE_GUIDE.md`

---

## Stack & Tools

**Core Stack:**
- SvelteKit (Svelte 5 with runes)
- SQLite (better-sqlite3)
- Node.js 20
- Docker

**Key Dependencies:**
- `sharp` - Image processing (thumbnails)
- `lucide-svelte` - Icons (only icon library)
- TailwindCSS 4 - Styling

**Package Manager:** pnpm

---

## Working with AI

**Best prompt pattern:**
```
"I want to [feature description]. Follow the existing patterns in the codebase."
```

**What AI discovers automatically:**
- File structure and organization
- API endpoint patterns
- Component patterns
- Database schema
- Import relationships

**What AI needs you to specify:**
- Your intent and requirements
- Any philosophy/constraint violations to avoid
- Specific patterns to follow (if not obvious)

**Don't waste time telling AI to:**
- Read outdated documentation
- Follow "best practices" (it will follow YOUR practices)
- Understand the architecture (it will explore the code)

---

## Quick Reference

### Environment
- **Development:** Uses `test-media/`, `test-config/`, `test-metadata/` if Docker volumes not mounted
- **Production:** Requires `/media` (read-only), `/config`, `/metadata` volumes
- **Database:** Single SQLite file at `$CONFIG_DIR/moss.db`

### Key Patterns
- **Database:** Singleton via `getDatabase()` from `src/lib/server/db`
- **Logging:** Singleton via `getLogger('module-name')` from `src/lib/server/logging`
- **Errors:** Custom error classes in `src/lib/server/errors`, handled via `handleError()`
- **Path validation:** All user paths validated via `validateMediaPath()` from `src/lib/server/security`
- **Components:** Svelte 5 runes (`$state`, `$derived`, `$effect`) - no legacy syntax

### Critical Files
- `src/lib/server/db/schema.ts` - Database schema definition
- `src/lib/server/db/migrations.ts` - Schema evolution history
- `src/hooks.server.ts` - Server initialization (DB init, background jobs)
- `STYLE_GUIDE.md` - UI design system and component patterns
- `.env.example` - Environment variable reference

---

This guide captures the unchanging philosophy and constraints. For implementation details, read the actual codebase - it's the source of truth.
