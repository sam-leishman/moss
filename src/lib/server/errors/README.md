# Error Handling Module

Comprehensive error handling framework for XView with custom error types, error codes, and centralized error handling.

## Features

- **Custom error classes**: Domain-specific error types
- **Error codes**: Standardized error codes for all error types
- **Centralized handling**: Consistent error responses
- **Logging integration**: Automatic error logging
- **Type safety**: Full TypeScript support
- **HTTP status mapping**: Automatic status code assignment

## Error Codes

Errors are organized by category with unique numeric codes:

- **1000-1099**: General errors
- **1100-1199**: Validation errors
- **1200-1299**: Database errors
- **1300-1399**: File system errors
- **1400-1499**: Library errors
- **1500-1599**: Media errors
- **1600-1699**: Security errors

## Custom Error Classes

### AppError (Base Class)

All custom errors extend `AppError`:

```typescript
abstract class AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;
  cause?: Error;
  timestamp: Date;
}
```

### ValidationError

For input validation failures:

```typescript
import { ValidationError } from '$lib/server/errors';

throw new ValidationError('Invalid email format', { email: 'invalid@' });
```

### DatabaseError

For database operation failures:

```typescript
import { DatabaseError } from '$lib/server/errors';

throw new DatabaseError('Failed to insert record', { table: 'users' }, error);
```

### NotFoundError

For resource not found errors:

```typescript
import { NotFoundError } from '$lib/server/errors';

throw new NotFoundError('Library', libraryId);
// Error: Library not found: 123
```

### DuplicateEntryError

For unique constraint violations:

```typescript
import { DuplicateEntryError } from '$lib/server/errors';

throw new DuplicateEntryError('Library', 'name', 'My Library');
// Error: Library with name 'My Library' already exists
```

### FileSystemError

For file system operation failures:

```typescript
import { FileSystemError } from '$lib/server/errors';

throw new FileSystemError('Failed to read directory', '/media/library1', error);
```

### PermissionDeniedError

For permission/access errors:

```typescript
import { PermissionDeniedError } from '$lib/server/errors';

throw new PermissionDeniedError('/media/restricted', 'read');
// Error: Permission denied for read: /media/restricted
```

### LibraryError

For library-specific errors:

```typescript
import { LibraryError } from '$lib/server/errors';

throw new LibraryError('Failed to scan library', libraryId, error);
```

### MediaScanError

For media scanning errors:

```typescript
import { MediaScanError } from '$lib/server/errors';

throw new MediaScanError('Failed to process media file', filePath, error);
```

### SecurityError

For security violations:

```typescript
import { SecurityError } from '$lib/server/errors';

throw new SecurityError('Path traversal attempt detected', { path: '../../etc/passwd' });
```

### RateLimitError

For rate limit violations:

```typescript
import { RateLimitError } from '$lib/server/errors';

throw new RateLimitError(60); // Retry after 60 seconds
```

## Error Handler

### handleError

Centralized error handling with automatic logging and response formatting:

```typescript
import { handleError, createErrorContext } from '$lib/server/errors';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
  const context = createErrorContext(event);
  
  try {
    // Your logic here
    return json({ success: true });
  } catch (error) {
    return handleError(error, context);
  }
}
```

### Error Response Format

All errors return a consistent JSON structure:

```typescript
interface ErrorResponse {
  error: string;           // Error class name
  message: string;         // Human-readable message
  code: number;            // Error code
  statusCode: number;      // HTTP status code
  requestId: string;       // Unique request identifier
  timestamp: string;       // ISO timestamp
  details?: object;        // Additional error details
}
```

Example response:

```json
{
  "error": "NotFoundError",
  "message": "Library not found: 123",
  "code": 1204,
  "statusCode": 404,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-28T23:00:00.000Z",
  "details": {
    "resource": "Library",
    "identifier": 123
  }
}
```

## Usage Examples

### API Route with Error Handling

```typescript
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { handleError, createErrorContext, NotFoundError } from '$lib/server/errors';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('API:Libraries');

export async function GET({ params }: RequestEvent) {
  const context = createErrorContext(event);
  
  try {
    const libraryId = parseInt(params.id);
    const library = await getLibrary(libraryId);
    
    if (!library) {
      throw new NotFoundError('Library', libraryId);
    }
    
    logger.info('Library retrieved', { libraryId });
    return json(library);
  } catch (error) {
    return handleError(error, context);
  }
}
```

### Database Operations

```typescript
import { DatabaseError, DuplicateEntryError } from '$lib/server/errors';
import { getDatabase } from '$lib/server/db';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('Database');

export function createLibrary(name: string, folderPath: string) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(
      'INSERT INTO library (name, folder_path) VALUES (?, ?)'
    );
    const result = stmt.run(name, folderPath);
    
    logger.info('Library created', { libraryId: result.lastInsertRowid });
    return result.lastInsertRowid;
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      throw new DuplicateEntryError('Library', 'name', name);
    }
    throw new DatabaseError('Failed to create library', { name, folderPath }, error);
  }
}
```

### File System Operations

```typescript
import { FileSystemError, PermissionDeniedError } from '$lib/server/errors';
import { readdirSync } from 'fs';

export function listDirectory(path: string): string[] {
  try {
    return readdirSync(path);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('EACCES')) {
        throw new PermissionDeniedError(path, 'read');
      }
      if (error.message.includes('ENOENT')) {
        throw new FileSystemError('Directory not found', path, error);
      }
    }
    throw new FileSystemError('Failed to list directory', path, error);
  }
}
```

### Validation

```typescript
import { ValidationError } from '$lib/server/errors';
import { sanitizeLibraryName } from '$lib/server/security';

export function validateLibraryInput(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Invalid input format');
  }
  
  const { name, folderPath } = input as any;
  
  if (!name) {
    throw new ValidationError('Library name is required', { field: 'name' });
  }
  
  if (!folderPath) {
    throw new ValidationError('Folder path is required', { field: 'folderPath' });
  }
  
  try {
    sanitizeLibraryName(name);
  } catch (error) {
    throw new ValidationError('Invalid library name', { name }, error);
  }
}
```

## Utility Functions

### isAppError

Check if an error is an AppError:

```typescript
import { isAppError } from '$lib/server/errors';

if (isAppError(error)) {
  console.log(`Error code: ${error.code}`);
  console.log(`Status: ${error.statusCode}`);
}
```

### getErrorCode

Get error code from any error:

```typescript
import { getErrorCode, ErrorCode } from '$lib/server/errors';

const code = getErrorCode(error);
if (code === ErrorCode.NOT_FOUND) {
  // Handle not found
}
```

### getStatusCode

Get HTTP status code from any error:

```typescript
import { getStatusCode } from '$lib/server/errors';

const status = getStatusCode(error); // Returns 500 for unknown errors
```

### logAndThrow

Log an error and re-throw it:

```typescript
import { logAndThrow } from '$lib/server/errors';

try {
  await riskyOperation();
} catch (error) {
  logAndThrow(error, 'RiskyOperation', { operationId: 123 });
}
```

### wrapDatabaseError

Wrap database errors with logging:

```typescript
import { wrapDatabaseError } from '$lib/server/errors';

try {
  db.prepare('SELECT * FROM users').all();
} catch (error) {
  wrapDatabaseError(error, 'SELECT users');
}
```

### wrapFileSystemError

Wrap file system errors with logging:

```typescript
import { wrapFileSystemError } from '$lib/server/errors';

try {
  readdirSync(path);
} catch (error) {
  wrapFileSystemError(error, path, 'list directory');
}
```

## Best Practices

### 1. Use Specific Error Types

```typescript
// Good: Use specific error type
throw new NotFoundError('Library', libraryId);

// Bad: Use generic error
throw new Error('Library not found');
```

### 2. Include Context

```typescript
// Good: Include relevant details
throw new DatabaseError('Failed to insert', { table: 'media', id: 123 }, error);

// Bad: Missing context
throw new DatabaseError('Failed to insert');
```

### 3. Chain Errors

```typescript
// Good: Preserve original error
try {
  await operation();
} catch (error) {
  throw new LibraryError('Operation failed', libraryId, error);
}

// Bad: Lose original error
try {
  await operation();
} catch (error) {
  throw new LibraryError('Operation failed', libraryId);
}
```

### 4. Handle Errors at Boundaries

```typescript
// API route - handle all errors
export async function POST(event: RequestEvent) {
  try {
    // Business logic
  } catch (error) {
    return handleError(error, createErrorContext(event));
  }
}

// Service layer - throw specific errors
export function createLibrary(name: string) {
  if (!name) {
    throw new ValidationError('Name required');
  }
  // ...
}
```

### 5. Log Before Throwing

```typescript
import { getLogger } from '$lib/server/logging';

const logger = getLogger('LibraryService');

export function deleteLibrary(id: number) {
  const library = getLibrary(id);
  
  if (!library) {
    logger.warn('Attempted to delete non-existent library', { id });
    throw new NotFoundError('Library', id);
  }
  
  // Delete logic
}
```

## Integration with Existing Errors

The error handler automatically handles errors from other modules:

- **PathValidationError** → 400 Bad Request
- **SanitizationError** → 400 Bad Request
- **AppError** → Uses error's statusCode
- **Error** → 500 Internal Server Error

## Error Serialization

AppError instances can be serialized to JSON:

```typescript
const error = new NotFoundError('Library', 123);
const json = error.toJSON();

// Output:
{
  "name": "NotFoundError",
  "message": "Library not found: 123",
  "code": 1204,
  "statusCode": 404,
  "details": { "resource": "Library", "identifier": 123 },
  "timestamp": "2026-01-28T23:00:00.000Z"
}
```

## Testing

```typescript
import { NotFoundError, isAppError, ErrorCode } from '$lib/server/errors';

test('NotFoundError', () => {
  const error = new NotFoundError('User', 123);
  
  expect(isAppError(error)).toBe(true);
  expect(error.code).toBe(ErrorCode.NOT_FOUND);
  expect(error.statusCode).toBe(404);
  expect(error.message).toBe('User not found: 123');
});
```
