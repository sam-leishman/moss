# Security Module

This module provides comprehensive security features for XView including path validation, input sanitization, and middleware utilities.

## Components

### Path Validator (`path-validator.ts`)

Ensures all file system access is restricted to allowed directories and prevents path traversal attacks.

#### Features
- **Boundary Enforcement**: Restricts access to specified root directory
- **Path Traversal Prevention**: Resolves symlinks and validates canonical paths
- **Null Byte Protection**: Rejects paths containing null bytes
- **Symlink Control**: Optional symlink validation
- **Existence Checking**: Validates paths exist when required

#### Usage

```typescript
import { validateMediaPath, isMediaPathSafe } from '$lib/server/security';

// Validate a path (throws PathValidationError if invalid)
const safePath = validateMediaPath('/media/library1/image.jpg');

// Check if a path is safe (returns boolean)
if (isMediaPathSafe(userInput)) {
  // Process path
}

// Custom validator
import { PathValidator } from '$lib/server/security';

const validator = new PathValidator('/allowed/root');
const validated = validator.validatePath(userInput, {
  mustExist: true,
  allowSymlinks: false
});
```

### Input Sanitizer (`sanitizer.ts`)

Provides type-safe input validation and sanitization for all user inputs.

#### Features
- **String Sanitization**: Length limits, pattern matching, trimming
- **Integer Validation**: Range checking, type coercion
- **Enum Validation**: Type-safe enum checking
- **Domain-Specific Validators**: Pre-configured for tags, titles, names, etc.

#### Usage

```typescript
import {
  sanitizeTagName,
  sanitizeTitle,
  sanitizePersonName,
  sanitizeLibraryName,
  sanitizeInteger,
  sanitizeMediaType,
  sanitizePersonRole,
  sanitizeArtistStyle
} from '$lib/server/security';

// Sanitize user inputs
const tagName = sanitizeTagName(userInput); // Max 50 chars, alphanumeric + _ - space
const title = sanitizeTitle(userInput); // Max 255 chars, can be empty
const personName = sanitizePersonName(userInput); // Max 100 chars, required
const libraryName = sanitizeLibraryName(userInput); // Max 100 chars, alphanumeric

// Validate integers
const age = sanitizeInteger(userInput, { min: 0, max: 150 });
const id = sanitizePositiveInteger(userInput); // Must be >= 1

// Validate enums
const mediaType = sanitizeMediaType(userInput); // 'image' | 'video' | 'animated'
const role = sanitizePersonRole(userInput); // 'artist' | 'performer'
const style = sanitizeArtistStyle(userInput); // '2d_animator' | '3d_animator' | ...
```

### Middleware (`middleware.ts`)

Provides security middleware utilities for API routes.

#### Features
- **Security Context**: Request tracking with unique IDs
- **Error Handling**: Consistent error responses
- **Content-Type Validation**: Ensures proper request formats
- **JSON Body Parsing**: Safe JSON parsing with validation
- **Rate Limiting**: In-memory rate limiting per IP
- **Client IP Detection**: Handles proxied requests

#### Usage

```typescript
import {
  createSecurityContext,
  handleSecurityError,
  parseJsonBody,
  checkRateLimit,
  rateLimitKey
} from '$lib/server/security';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
  const context = createSecurityContext(event);
  
  try {
    // Rate limiting
    const key = rateLimitKey(event);
    if (!checkRateLimit(key, { maxRequests: 100, windowMs: 60000 })) {
      return json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    
    // Parse and validate JSON body
    const body = await parseJsonBody<{ name: string }>(event);
    
    // Your logic here
    
  } catch (error) {
    return handleSecurityError(error, context);
  }
}
```

## Security Best Practices

### Path Validation
1. **Always validate** user-provided paths before file system operations
2. **Use validateMediaPath** for any media file access
3. **Never trust** user input - always validate and sanitize
4. **Check existence** when required using `mustExist: true`

### Input Sanitization
1. **Sanitize all inputs** before database operations
2. **Use domain-specific validators** (sanitizeTagName, etc.) when available
3. **Handle errors gracefully** - catch SanitizationError
4. **Validate enums** using type-safe validators

### API Security
1. **Create security context** for all API routes
2. **Use handleSecurityError** for consistent error responses
3. **Implement rate limiting** on sensitive endpoints
4. **Validate content-type** for POST/PUT requests
5. **Log security events** for monitoring

## Error Handling

All security functions throw specific error types:

- **PathValidationError**: Path validation failures
- **SanitizationError**: Input validation failures

These are automatically handled by `handleSecurityError` middleware:

```typescript
try {
  const path = validateMediaPath(userPath);
  const name = sanitizeLibraryName(userName);
} catch (error) {
  return handleSecurityError(error, context);
}
```

## Environment Configuration

Configure security paths via environment variables:

- **MEDIA_PATH**: Root directory for media libraries
  - Development: `./test-media`
  - Production: `/media`
  
- **CONFIG_DIR**: Directory for database and configuration
  - Development: `./test-config`
  - Production: `/config`

## Rate Limiting

In-memory rate limiting with automatic cleanup:

```typescript
const key = rateLimitKey(event);
const allowed = checkRateLimit(key, {
  maxRequests: 100,  // Max requests
  windowMs: 60000    // Per 60 seconds
});
```

Rate limit store is automatically cleaned every 60 seconds.

## Security Guarantees

✅ **Path Traversal Protection**: All paths validated against allowed root
✅ **Null Byte Protection**: Rejects paths with null bytes
✅ **Symlink Resolution**: Resolves and validates symlinks
✅ **Input Length Limits**: Prevents buffer overflow attacks
✅ **Type Safety**: TypeScript ensures correct types
✅ **Enum Validation**: Only allows predefined values
✅ **SQL Injection Prevention**: Use with prepared statements
✅ **XSS Prevention**: Sanitize all user inputs
✅ **Rate Limiting**: Prevents abuse and DoS attacks
