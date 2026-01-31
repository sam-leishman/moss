# XView - Media Library Management Application

## Overview
XView is a Dockerized Svelte-based web application for managing media libraries on a NAS. It provides comprehensive tagging, multi-library support, and detailed credit attribution for media items.

## Core Features

### 1. Multi-Library Management
- **Multiple Libraries**: Users can create separate libraries by selecting different folders (similar to Audiobookshelf/Jellyfin)
- **Library Configuration**: Each library points to a specific directory on the mounted volume
- **Independent Management**: Libraries operate independently with their own media collections

### 2. Media Management
- **Supported Formats**: 
  - **Images**: JPEG, PNG, WebP, BMP, TIFF, SVG
  - **Videos**: MP4, WebM, MKV, AVI, MOV
  - **Animated**: GIF, APNG
- **File Scanning**: Automatically scan selected directories for supported media files
- **Metadata Storage**: Track file path, size, modification time, and media type
- **Media Display**: Grid/list views with lazy loading for performance
- **Thumbnail Generation**: Automatic thumbnail creation and caching in metadata volume

### 3. Tagging System

#### Basic Metadata
- **Title**: Custom title for each media item
- **Custom Tags**: Flexible tagging system for categorization

#### Credit System (Complex)
The application supports detailed credit attribution for media items:

**Person Management**:
- Each person has a unique name and a single role (performer, artist, etc.)
- Role is fixed per person and determines their profile type
- Role-specific attributes stored in dedicated profile tables:
  - **Artists**: Have an artist profile with style classification (2D animator, 3D animator, illustrator, etc.)
  - **Performers**: Have a performer profile with performer-specific attributes

**Media Credits**:
- Link media items to people with unique constraints
- Multiple people can be credited on the same media item
- Each person can only be credited once per media item

## Technical Architecture

### Frontend
- **Framework**: SvelteKit
- **UI Components**: Modern, responsive interface
- **Features**:
  - Library selector/manager
  - Media browser with filtering
  - Tagging interface
  - Credit management UI
  - Person/artist management

### Backend
- **Database**: SQLite
- **API**: SvelteKit API routes
- **File System**: Read-only access to mounted media volumes

### Database Schema

#### Core Tables
- `media`: File metadata (path, size, mtime, title, media_type, library_id)
  - Indexed on: path, library_id, media_type
  - Library determined by folder path prefix matching
- `person`: All credited individuals (name UNIQUE, role)
  - Indexed on: name
- `media_credit`: Links media to people (UNIQUE constraint on media_id + person_id)
  - Indexed on: media_id, person_id
- `tag`: Available tags (name UNIQUE, max 50 chars)
  - Indexed on: name
- `media_tag`: Media-to-tag relationships
  - Indexed on: media_id, tag_id
- `library`: Library configuration (name UNIQUE, folder_path UNIQUE)
  - Folder path must be within /media mount
  - Indexed on: folder_path
- `schema_version`: Database migration tracking (version, applied_at)

#### Role-Specific Tables
- `artist_profile`: Artist-specific attributes (person_id UNIQUE, style)
- `performer_profile`: Performer-specific attributes (person_id UNIQUE, age)

### Docker Configuration
- **Container**: Node.js-based Svelte app
- **Ports**: 3000 (web UI)
- **Volumes**:
  - `/media`: Read-only media files (mounted at container setup)
  - `/config`: Application configuration and SQLite database
  - `/metadata`: Generated thumbnails and cached data
- **Environment**:
  - Timezone configuration
  - Production mode
  - Network accessibility (HOST=0.0.0.0)
- **Security**:
  - Library folder selection restricted to /media mount
  - Path traversal prevention and sanitization
  - Symlink resolution with boundary checks

## Development Roadmap

### Phase 1: Foundation
- [x] Set up SvelteKit project structure
- [x] Implement SQLite database with schema and indexes
- [x] Database migration system with version tracking
- [x] Create Docker build configuration with all volumes
- [x] Path validation and security middleware
- [x] Basic file system scanning with media type detection
- [x] Error handling framework and logging

### Phase 2: Library Management
- [x] Library creation/deletion UI with validation
- [x] Folder selection interface (restricted to /media mount)
- [x] Library switching
- [x] Media scanning per library with error recovery
- [x] Orphaned media cleanup (files deleted from disk)

### Phase 3: Media Browsing
- [x] Media grid/list views with lazy loading
- [x] Thumbnail generation (stored in /metadata volume)
- [x] Thumbnail cleanup for orphaned media
- [x] Pagination for large libraries (100 items per page)
- [x] Basic filtering and search with indexed queries
- [x] Media detail view with type-specific viewers

### Phase 4: Tagging System
- [x] Tag creation and management with validation
- [x] Tag assignment UI
- [x] Tag-based filtering with indexed searches
- [x] Bulk tagging operations with transaction safety

### Phase 5: Credit System
- [x] Person management (create, edit, delete) with uniqueness validation
- [x] Credit assignment to media items with duplicate prevention
- [x] Credit display on media items
- [x] Person profile pages
- [x] Artist style classification
- [x] Role-specific profile management
- [x] Cascade delete handling for person removal

### Phase 6: Advanced Features
- [ ] Advanced search and filtering with combined criteria
- [ ] Bulk operations with progress tracking
- [ ] Database backup/restore functionality
- [ ] Export/import functionality
- [ ] Statistics and analytics
- [ ] Performance monitoring for large libraries

## Future Considerations

1. **Permissions**: Multi-user support or single-user application?
2. **API Evolution**: RESTful vs GraphQL for frontend-backend communication
3. **Real-time Updates**: File system watching for new media
4. **Deduplication**: Add SHA256 hashing if needed later
5. **Additional Metadata**: EXIF data extraction, file format specifics
6. **Audio Support**: Extend to audio files if needed
7. **Advanced Thumbnail Options**: Size presets, quality settings

## Technical Notes

### Data Integrity
- Unique constraints prevent duplicate people, tags, and library paths
- Foreign key constraints with cascade rules maintain referential integrity
- Transaction-based operations ensure atomic updates
- Schema versioning enables safe database migrations

### Performance Strategy
- Indexed columns on all foreign keys and search fields
- Lazy loading and pagination for media grids (100 items/page)
- Thumbnail pre-generation and caching in /metadata volume
- Optimized queries for libraries with 10k+ items

### Security Model
- Read-only /media volume ensures source files are never modified
- Path validation prevents access outside /media mount
- Input sanitization on all user-provided data (titles, tags, names)
- Symlink resolution with boundary enforcement

### Error Handling
- Graceful handling of missing/moved files
- Database corruption recovery procedures
- Failed scan resumption capabilities
- Orphaned thumbnail cleanup on media deletion

### Architecture Decisions
- SQLite provides simplicity for single-user NAS deployment
- Docker deployment ensures easy installation and updates
- Library membership determined by folder path matching (no junction table needed)
- Person roles are fixed to maintain data model consistency
