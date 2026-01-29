# Scanner Module

This module provides file system scanning and media type detection for XView.

## Components

### Media Detector (`media-detector.ts`)

Detects media types based on file extensions.

#### Supported Formats

- **Images**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`, `.tiff`, `.tif`, `.svg`
- **Videos**: `.mp4`, `.webm`, `.mkv`, `.avi`, `.mov`
- **Animated**: `.gif`, `.apng`

#### Usage

```typescript
import { 
  detectMediaType, 
  isSupportedMediaFile,
  getSupportedExtensions,
  getExtensionsByType,
  SUPPORTED_FORMATS
} from '$lib/server/scanner';

// Detect media type from file path
const type = detectMediaType('/media/image.jpg'); // Returns: 'image'
const type2 = detectMediaType('/media/video.mp4'); // Returns: 'video'
const type3 = detectMediaType('/media/animation.gif'); // Returns: 'animated'
const type4 = detectMediaType('/media/document.pdf'); // Returns: null

// Check if file is supported
if (isSupportedMediaFile('/media/photo.png')) {
  // Process media file
}

// Get all supported extensions
const extensions = getSupportedExtensions();
// Returns: ['.jpg', '.jpeg', '.png', ...]

// Get extensions by type
const imageExts = getExtensionsByType('image');
// Returns: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.svg']

// Access format constants
console.log(SUPPORTED_FORMATS.image);
console.log(SUPPORTED_FORMATS.video);
console.log(SUPPORTED_FORMATS.animated);
```

### File Scanner (`file-scanner.ts`)

Recursively scans directories for supported media files with metadata extraction.

#### Features

- **Recursive scanning**: Traverse directory trees
- **Media filtering**: Only returns supported media files
- **Metadata extraction**: File size, modification time
- **Path validation**: Integrates with security module
- **Error handling**: Graceful handling of permission errors
- **Progress callbacks**: Real-time scan progress
- **Configurable depth**: Limit recursion depth
- **Symlink control**: Optional symlink following

#### Usage

##### Basic Scanning

```typescript
import { scanDirectory, scanDirectoryQuick } from '$lib/server/scanner';

// Full scan with options
const result = await scanDirectory('/media/library1', {
  recursive: true,
  followSymlinks: false,
  maxDepth: 100,
  onProgress: (file) => {
    console.log(`Found: ${file.relativePath}`);
  },
  onError: (path, error) => {
    console.error(`Error scanning ${path}:`, error.message);
  }
});

console.log(`Found ${result.totalFiles} files`);
console.log(`Total size: ${result.totalSize} bytes`);
console.log(`Scanned ${result.scannedDirectories} directories`);
console.log(`Errors: ${result.errors.length}`);

// Quick scan (uses defaults)
const files = await scanDirectoryQuick('/media/library1');
files.forEach(file => {
  console.log(file.path, file.mediaType, file.size);
});
```

##### Using FileScanner Class

```typescript
import { FileScanner } from '$lib/server/scanner';

const scanner = new FileScanner('/media/library1');

const result = await scanner.scan({
  recursive: true,
  maxDepth: 50,
  onProgress: (file) => {
    // Update UI or database
    console.log(`Scanned: ${file.relativePath}`);
  }
});

console.log(`Root path: ${scanner.getRootPath()}`);
```

##### Scan Result Structure

```typescript
interface ScanResult {
  files: ScannedFile[];        // Array of found media files
  totalFiles: number;          // Count of media files
  totalSize: number;           // Total size in bytes
  errors: Array<{              // Errors encountered
    path: string;
    error: string;
  }>;
  scannedDirectories: number;  // Number of directories scanned
}

interface ScannedFile {
  path: string;                // Absolute path
  relativePath: string;        // Path relative to scan root
  mediaType: MediaType;        // 'image' | 'video' | 'animated'
  size: number;                // File size in bytes
  mtime: Date;                 // Last modification time
}
```

##### Scan Options

```typescript
interface ScanOptions {
  recursive?: boolean;         // Scan subdirectories (default: true)
  followSymlinks?: boolean;    // Follow symbolic links (default: false)
  maxDepth?: number;           // Maximum recursion depth (default: 100)
  onProgress?: (file: ScannedFile) => void;  // Progress callback
  onError?: (path: string, error: Error) => void;  // Error callback
}
```

## Integration with Security Module

The scanner automatically validates all paths using the security module:

```typescript
// Path validation happens automatically
const scanner = new FileScanner('/media/library1');
// Throws PathValidationError if path is outside MEDIA_PATH

// All scanned files are within the allowed root
const result = await scanner.scan();
// result.files[].path is guaranteed to be safe
```

## Error Handling

The scanner handles errors gracefully:

1. **Permission Errors**: Logged and skipped, scanning continues
2. **Invalid Paths**: Caught and reported in `errors` array
3. **Symlink Errors**: Handled based on `followSymlinks` option
4. **Missing Files**: Skipped with error callback

```typescript
const result = await scanDirectory('/media/library1', {
  onError: (path, error) => {
    if (error.message.includes('EACCES')) {
      console.log(`Permission denied: ${path}`);
    } else if (error.message.includes('ENOENT')) {
      console.log(`File not found: ${path}`);
    }
  }
});

// Check for errors after scan
if (result.errors.length > 0) {
  console.log('Scan completed with errors:');
  result.errors.forEach(({ path, error }) => {
    console.log(`  ${path}: ${error}`);
  });
}
```

## Performance Considerations

- **Large directories**: Use `maxDepth` to limit recursion
- **Progress updates**: Use `onProgress` for UI feedback
- **Memory usage**: Files are collected in memory; for very large libraries, consider batch processing
- **Symlinks**: Disabled by default to prevent loops

## Example: Library Scanning

```typescript
import { scanDirectory } from '$lib/server/scanner';
import { getDatabase } from '$lib/server/db';

async function scanLibrary(libraryId: number, libraryPath: string) {
  const db = getDatabase();
  let scannedCount = 0;
  
  const result = await scanDirectory(libraryPath, {
    recursive: true,
    onProgress: (file) => {
      scannedCount++;
      if (scannedCount % 100 === 0) {
        console.log(`Scanned ${scannedCount} files...`);
      }
    },
    onError: (path, error) => {
      console.error(`Error scanning ${path}:`, error.message);
    }
  });
  
  // Insert files into database
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO media (library_id, path, media_type, size, mtime)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((files) => {
    for (const file of files) {
      insertStmt.run(
        libraryId,
        file.path,
        file.mediaType,
        file.size,
        file.mtime.toISOString()
      );
    }
  });
  
  transaction(result.files);
  
  console.log(`Library scan complete:`);
  console.log(`  Files: ${result.totalFiles}`);
  console.log(`  Size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Directories: ${result.scannedDirectories}`);
  console.log(`  Errors: ${result.errors.length}`);
  
  return result;
}
```

## Best Practices

1. **Always handle errors**: Use `onError` callback or check `result.errors`
2. **Provide progress feedback**: Use `onProgress` for long-running scans
3. **Limit recursion depth**: Set `maxDepth` for deep directory structures
4. **Validate paths first**: Scanner does this automatically, but be aware
5. **Don't follow symlinks**: Keep `followSymlinks: false` to prevent loops
6. **Batch database operations**: Use transactions for inserting scan results
7. **Monitor performance**: Log scan statistics for optimization

## Security

- All paths validated against `MEDIA_PATH` environment variable
- Symlinks disabled by default to prevent directory traversal
- Path traversal attacks prevented by security module integration
- Only supported media types are returned
- File system errors don't expose sensitive information
