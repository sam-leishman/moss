# Thumbnail Generation System

This module handles thumbnail generation and caching for media files in Moss.

## Features

- **Automatic Thumbnail Generation**: Creates WebP thumbnails for images, videos, and animated media
- **Smart Caching**: Uses SHA-256 hashing to cache thumbnails in the `/metadata` volume
- **Video Support**: Extracts first frame from videos using FFmpeg (with fallback to placeholder)
- **Orphan Cleanup**: Automatically removes thumbnails for deleted media files

## Architecture

### Directory Structure

Thumbnails are stored in the metadata volume with the following structure:
```
/metadata/thumbnails/
  ├── 00/
  │   └── 00abc123...def.webp
  ├── 01/
  │   └── 01xyz789...abc.webp
  └── ...
```

The first two characters of the SHA-256 hash are used as a subdirectory to prevent too many files in a single directory.

### Thumbnail Generation

1. **Images & Animated**: Direct conversion using Sharp
2. **Videos**: FFmpeg extracts first frame, then Sharp converts to WebP
3. **Fallback**: SVG placeholder if FFmpeg is unavailable

### Default Options

- **Size**: 300x300 pixels
- **Quality**: 80%
- **Fit**: Cover (maintains aspect ratio, crops if needed)
- **Format**: WebP (optimal compression and quality)

## Usage

### Generate Thumbnail

```typescript
import { getThumbnailGenerator } from '$lib/server/thumbnails';

const thumbnailGen = getThumbnailGenerator();
const thumbnailPath = await thumbnailGen.generateThumbnail(
  '/media/library/image.jpg',
  'image'
);
```

### Custom Options

```typescript
const thumbnailPath = await thumbnailGen.generateThumbnail(
  '/media/library/video.mp4',
  'video',
  {
    width: 400,
    height: 400,
    quality: 90,
    fit: 'contain'
  }
);
```

### Check if Thumbnail Exists

```typescript
const exists = thumbnailGen.thumbnailExists('/media/library/image.jpg');
```

### Delete Thumbnail

```typescript
await thumbnailGen.deleteThumbnail('/media/library/image.jpg');
```

### Cleanup Orphaned Thumbnails

```typescript
const validMediaPaths = new Set(['/media/lib/image1.jpg', '/media/lib/image2.jpg']);
const deletedCount = await thumbnailGen.cleanupOrphanedThumbnails(validMediaPaths);
```

## API Endpoints

### Get Thumbnail
```
GET /api/media/[id]/thumbnail
```
Returns the thumbnail for a media item, generating it if needed.

### Cleanup Orphaned Thumbnails
```
POST /api/thumbnails/cleanup
```
Manually triggers cleanup of orphaned thumbnails across all libraries.

## Integration

Thumbnails are automatically cleaned up when:
1. Media files are removed during library scanning
2. Libraries are deleted (via CASCADE foreign key)
3. Manual cleanup is triggered via API

## Performance Considerations

- Thumbnails are cached indefinitely (immutable)
- Cache-Control headers set for 1 year
- Lazy generation (only when requested)
- Subdirectory structure prevents filesystem bottlenecks

## Dependencies

- **sharp**: Image processing and resizing
- **ffmpeg**: Video frame extraction (optional, falls back to placeholder)

## Error Handling

- Missing source files return 404
- FFmpeg failures fall back to placeholder thumbnails
- Thumbnail generation errors are logged but don't crash the application
