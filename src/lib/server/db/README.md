# Database Module

This module provides SQLite database functionality for Moss using `better-sqlite3`.

## Structure

- **`connection.ts`**: Database connection management with optimized pragmas
- **`schema.ts`**: Table definitions and indexes
- **`migrations.ts`**: Migration system with version tracking
- **`init.ts`**: Database initialization
- **`types.ts`**: TypeScript interfaces for database entities
- **`index.ts`**: Public API exports

## Usage

### Initialization

The database is automatically initialized when the application starts via `hooks.server.ts`:

```typescript
import { initializeDatabase } from '$lib/server/db';

initializeDatabase();
```

### Getting a Database Connection

```typescript
import { getDatabase } from '$lib/server/db';

const db = getDatabase();
```

### Database Configuration

The database file is stored at:
- Development: `./test-config/moss.db`
- Production: `$CONFIG_DIR/moss.db` (Docker volume mount at `/config`)

### Pragmas

The following SQLite pragmas are enabled for optimal performance:
- `journal_mode = WAL`: Write-Ahead Logging for better concurrency
- `foreign_keys = ON`: Enforce referential integrity
- `synchronous = NORMAL`: Balance between safety and performance
- `cache_size = -64000`: 64MB cache
- `temp_store = MEMORY`: Store temporary tables in memory

## Schema

### Tables

1. **`library`**: Library configuration
   - Unique name and folder_path
   - Indexed on folder_path

2. **`media`**: Media files
   - Links to library via library_id
   - Unique path per file
   - Indexed on: library_id, path, media_type

3. **`tag`**: Available tags
   - Unique name (max 50 chars)
   - Indexed on name

4. **`media_tag`**: Media-to-tag relationships
   - Composite primary key (media_id, tag_id)
   - Indexed on both foreign keys

5. **`person`**: All credited individuals
   - Unique name
   - Role: 'artist' or 'performer'
   - Indexed on: name, role

6. **`artist_profile`**: Artist-specific attributes
   - One-to-one with person
   - Style classification

7. **`performer_profile`**: Performer-specific attributes
   - One-to-one with person
   - Age attribute

8. **`media_credit`**: Media-to-person credits
   - Composite primary key (media_id, person_id)
   - Indexed on both foreign keys

9. **`schema_version`**: Migration tracking
   - Tracks applied migrations

## Migrations

The migration system supports:
- Forward migrations (up)
- Rollback migrations (down)
- Version tracking
- Transactional execution

Current schema version: **1**

### Running Migrations

Migrations run automatically on initialization. To manually run:

```typescript
import { runMigrations, getDatabase } from '$lib/server/db';

const db = getDatabase();
runMigrations(db);
```

### Rolling Back

```typescript
import { rollbackMigration, getDatabase } from '$lib/server/db';

const db = getDatabase();
rollbackMigration(db, 0); // Rollback to version 0
```

## Data Integrity

- **Foreign Keys**: Enabled with CASCADE delete rules
- **Unique Constraints**: Prevent duplicate libraries, tags, people, and credits
- **Check Constraints**: Validate media_type, role, and style values
- **Transactions**: All migrations run in transactions for atomicity

## Performance

- All foreign keys are indexed
- Composite indexes on frequently queried combinations
- WAL mode for better read concurrency
- Optimized cache and temp storage settings
