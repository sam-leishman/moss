# Logging Module

Structured logging system for XView with configurable log levels and contextual logging.

## Features

- **Multiple log levels**: DEBUG, INFO, WARN, ERROR, FATAL
- **Contextual logging**: Hierarchical context support
- **Environment-aware**: Auto-configures based on NODE_ENV
- **Structured output**: Consistent log format with timestamps
- **Child loggers**: Create scoped loggers with context inheritance

## Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,  // Detailed debugging information
  INFO = 1,   // General informational messages
  WARN = 2,   // Warning messages
  ERROR = 3,  // Error messages
  FATAL = 4   // Fatal errors that may cause shutdown
}
```

## Usage

### Basic Logging

```typescript
import { getLogger } from '$lib/server/logging';

const logger = getLogger('MyModule');

logger.debug('Debugging information', { userId: 123 });
logger.info('User logged in', { userId: 123, username: 'john' });
logger.warn('Deprecated API usage', { endpoint: '/old-api' });
logger.error('Failed to process request', error, { requestId: 'abc123' });
logger.fatal('Database connection lost', error);
```

### Creating Custom Loggers

```typescript
import { createLogger, LogLevel } from '$lib/server/logging';

// Create logger with custom options
const logger = createLogger({
  minLevel: LogLevel.INFO,
  context: 'DatabaseService',
  enableConsole: true
});

logger.info('Database initialized');
```

### Child Loggers

```typescript
const parentLogger = getLogger('API');
const childLogger = parentLogger.child('Users');

parentLogger.info('API started');  // [API] API started
childLogger.info('User created');  // [API:Users] User created
```

### Default Logger

```typescript
import { getLogger } from '$lib/server/logging';

// Get default logger (no context)
const logger = getLogger();
logger.info('Application started');
```

## Configuration

### Environment Variables

- **`LOG_LEVEL`**: Set minimum log level (DEBUG, INFO, WARN, ERROR, FATAL)
- **`NODE_ENV`**: Auto-configures log level
  - `production`: INFO and above
  - `development`: DEBUG and above

```bash
# .env
LOG_LEVEL=DEBUG
NODE_ENV=development
```

### Programmatic Configuration

```typescript
const logger = createLogger({
  minLevel: LogLevel.WARN,     // Only log WARN and above
  context: 'MyService',         // Add context to all logs
  enableConsole: true,          // Log to console (default: true)
  enableFile: false             // Log to file (default: false)
});
```

## Log Format

```
[timestamp] LEVEL [context] message {metadata}
```

Example:
```
[2026-01-28T23:00:00.000Z] INFO  [Database] Connection established {"host":"localhost","port":5432}
[2026-01-28T23:00:01.000Z] ERROR [API:Users] Failed to create user {"userId":123}
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// DEBUG: Detailed information for debugging
logger.debug('Processing item', { itemId: 123, step: 'validation' });

// INFO: General informational messages
logger.info('User logged in', { userId: 123 });

// WARN: Warning conditions that should be reviewed
logger.warn('API rate limit approaching', { current: 95, limit: 100 });

// ERROR: Error conditions that need attention
logger.error('Failed to send email', error, { userId: 123 });

// FATAL: Critical errors that may require immediate action
logger.fatal('Database connection lost', error);
```

### 2. Add Context

```typescript
// Create contextual loggers for different modules
const dbLogger = getLogger('Database');
const apiLogger = getLogger('API');
const scannerLogger = getLogger('Scanner');

dbLogger.info('Query executed', { duration: 45 });
apiLogger.info('Request received', { path: '/api/users' });
```

### 3. Include Metadata

```typescript
// Good: Include relevant metadata
logger.info('File scanned', {
  path: '/media/image.jpg',
  size: 1024000,
  type: 'image'
});

// Bad: Missing context
logger.info('File scanned');
```

### 4. Log Errors Properly

```typescript
try {
  await processFile(path);
} catch (error) {
  // Include error object and context
  logger.error(
    'Failed to process file',
    error instanceof Error ? error : new Error(String(error)),
    { path, operation: 'process' }
  );
  throw error;
}
```

### 5. Use Child Loggers for Scoped Operations

```typescript
const apiLogger = getLogger('API');

export async function handleUserRequest(userId: number) {
  const requestLogger = apiLogger.child(`User:${userId}`);
  
  requestLogger.info('Processing request');
  // [API:User:123] Processing request
  
  requestLogger.debug('Validating input');
  // [API:User:123] Validating input
}
```

## Integration Examples

### API Routes

```typescript
import { getLogger } from '$lib/server/logging';
import type { RequestEvent } from '@sveltejs/kit';

const logger = getLogger('API:Users');

export async function GET(event: RequestEvent) {
  const requestId = crypto.randomUUID();
  const requestLogger = logger.child(requestId);
  
  requestLogger.info('GET request received', {
    path: event.url.pathname,
    method: event.request.method
  });
  
  try {
    const users = await getUsers();
    requestLogger.info('Users retrieved', { count: users.length });
    return json(users);
  } catch (error) {
    requestLogger.error('Failed to retrieve users', error);
    throw error;
  }
}
```

### Database Operations

```typescript
import { getLogger } from '$lib/server/logging';
import { getDatabase } from '$lib/server/db';

const logger = getLogger('Database');

export function createUser(name: string) {
  logger.debug('Creating user', { name });
  
  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO users (name) VALUES (?)');
  
  try {
    const result = stmt.run(name);
    logger.info('User created', { userId: result.lastInsertRowid, name });
    return result.lastInsertRowid;
  } catch (error) {
    logger.error('Failed to create user', error, { name });
    throw error;
  }
}
```

### File Scanning

```typescript
import { getLogger } from '$lib/server/logging';
import { scanDirectory } from '$lib/server/scanner';

const logger = getLogger('Scanner');

export async function scanLibrary(path: string) {
  logger.info('Starting library scan', { path });
  
  const result = await scanDirectory(path, {
    onProgress: (file) => {
      logger.debug('File found', {
        path: file.relativePath,
        type: file.mediaType,
        size: file.size
      });
    },
    onError: (filePath, error) => {
      logger.warn('Error scanning file', { path: filePath, error: error.message });
    }
  });
  
  logger.info('Library scan complete', {
    path,
    files: result.totalFiles,
    size: result.totalSize,
    errors: result.errors.length
  });
  
  return result;
}
```

## Performance Considerations

- Log levels are checked before formatting messages
- Metadata is only serialized if the log will be output
- Child loggers share configuration with parent
- Console output is synchronous (consider async file logging for high-volume scenarios)

## Future Enhancements

- File-based logging with rotation
- Remote logging (e.g., to logging service)
- Log aggregation and search
- Performance metrics integration
- Structured JSON output option
