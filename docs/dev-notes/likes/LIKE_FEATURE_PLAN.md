# Like Feature Implementation Plan

## 1. Database Schema Changes

### Add `user_media_like` table
- Create new table to track which users have liked which media items
- Columns:
  - `user_id` (INTEGER, NOT NULL) - The user who liked the media
  - `media_id` (INTEGER, NOT NULL) - The media item that was liked
  - `created_at` (TEXT, timestamp) - When the like was created
- Composite primary key: `(user_id, media_id)` - Each user can like each media item once
- Foreign key constraints:
  - `user_id` references `user(id)` with `ON DELETE CASCADE`
  - `media_id` references `media(id)` with `ON DELETE CASCADE`
- Indexes:
  - Index on `user_id` for efficient user-specific queries
  - Index on `media_id` for efficient media-specific queries

### Update schema version
- Increment `SCHEMA_VERSION` from 6 to 7
- Create migration in `migrations.ts` to add the new table

## 2. Backend API Endpoints

### Create like management endpoints
- **POST** `/api/media/{id}/like` - Toggle like status for a media item (requires authentication)
  - Checks if current user has liked the media
  - Inserts like if not liked, deletes if already liked
  - Returns new like status
- **GET** `/api/media/{id}/like` - Check if current user has liked a media item (requires authentication)
  - Returns boolean indicating like status
- **GET** `/api/media/liked` - Get all media IDs liked by current user (requires authentication)
  - Returns array of media IDs
  - Respects library permissions (only returns IDs for media in accessible libraries)

### Update media query endpoint
- Modify `/api/media` GET endpoint to accept `liked` filter parameter
- When `liked=true`, add SQL JOIN to `user_media_like` table filtered by current user
- Ensure pagination works with liked filter
- Combine with existing library permission filtering

## 3. Frontend Components

### Update `MediaCard.svelte`
- Add heart icon button (using `lucide-svelte` Heart icon)
- Show button on hover with `opacity-0 group-hover:opacity-100` transition
- If liked, show filled/colored heart even without hover
- Position in top-left corner (opposite of media type icon)
- Handle click event to toggle like status (prevent card click propagation)
- Optimistic UI update with API call

### Update `MediaDetailModal.svelte`
- Add like button in the top button row (near Info, Edit, Close buttons)
- Use same Heart icon with filled state when liked
- Toggle like status on click
- Update UI immediately with optimistic rendering

### Update `MediaFilters.svelte`
- Add "Liked" filter toggle/checkbox
- Position with other filter options
- Update filter state to include `liked: boolean` parameter
- Clear liked filter when "Clear Filters" is clicked

## 4. State Management

### Add like state tracking
- Create stores or reactive state for:
  - Set of liked media IDs for current user (global, not per-library)
  - Loading state for like operations
- Load liked media IDs on app initialization (after auth)
- Update state when likes are toggled
- Clear state on logout

### Optimistic updates
- Immediately update UI when like button is clicked
- Revert if API call fails
- Show error toast on failure

## 5. Type Definitions

### Update TypeScript types
- Add `UserMediaLike` interface in `$lib/server/db/types.ts`:
  ```typescript
  export interface UserMediaLike {
    user_id: number;
    media_id: number;
    created_at: string;
  }
  ```
- Update API response types to include like status where needed
- Add filter types to include `liked` parameter

## 6. Database Operations

### Create like operations in `db/` folder
Create `$lib/server/db/likes.ts` with:
- `toggleMediaLike(db: Database, userId: number, mediaId: number)` - Insert or delete like record
  - Returns new like status (boolean)
  - Uses transaction for consistency
- `isMediaLiked(db: Database, userId: number, mediaId: number)` - Check like status
  - Returns boolean
- `getUserLikedMediaIds(db: Database, userId: number, libraryIds?: number[])` - Get all liked media for user
  - Optionally filter by library IDs (for permission filtering)
  - Returns array of media IDs
- `deleteLikesForUser(db: Database, userId: number)` - Delete all likes for a user
  - Called when user is deleted (handled by CASCADE, but useful for manual cleanup)

## 7. UI/UX Details

### Heart icon states
- **Unliked + not hovering**: Hidden (opacity-0)
- **Unliked + hovering**: Outline heart, white/light color
- **Liked + not hovering**: Filled heart, red/pink color (#ef4444 or similar)
- **Liked + hovering**: Filled heart, slightly brighter red

### Positioning
- **MediaCard**: Top-left corner with padding (e.g., `top-2 left-2`)
- **MediaDetailModal**: In top button row between Edit and Info buttons
- Use consistent sizing (w-10 h-10 for modal, w-8 h-8 for card)

## 8. Authorization & Security

### Authentication requirements
- All like endpoints require authentication (`requireAuth` middleware)
- Unauthenticated requests return 401 Unauthorized
- Users can only manage their own likes

### Permission filtering
- When fetching liked media IDs, respect library permissions
- Users can only see likes for media in libraries they have access to
- Admin users see all their likes across all libraries
- Regular users only see likes for media in permitted libraries

### Data isolation
- Each user's likes are completely separate
- No way to see other users' likes (privacy)
- Deleting a user cascades to delete all their likes

## 9. Testing Considerations

- Verify like state persists across page refreshes
- Test filtering shows only liked items for current user
- Ensure likes are scoped per user (different users can like the same media)
- Test cascade deletion when media is removed (likes are deleted)
- Test cascade deletion when user is removed (likes are deleted)
- Verify optimistic updates revert on API failure
- Test keyboard navigation in modal with like button
- Test that users cannot see other users' likes
- Test library permission filtering on liked media queries
- Test like functionality after logout/login with different users

## 10. Performance

- Batch load all liked media IDs for current user on app initialization (single query)
- Use Set data structure for O(1) like status lookups in frontend
- Composite primary key ensures no duplicate likes
- Indexes on both `user_id` and `media_id` ensure fast queries
- Consider adding a count column to media table if displaying like counts later (denormalization)

## 11. Migration Considerations

### Backward compatibility
- This is a new feature, no existing data to migrate
- No breaking changes to existing functionality
- Purely additive schema change

### Future enhancements
- Like counts per media (requires denormalization or aggregation)
- "Popular" filter based on like counts
- Like activity feed for admins
- Export/import user preferences including likes

---

## Implementation Notes

This plan integrates with XView's existing authentication system:
- Uses `event.locals.user` from session validation in `hooks.server.ts`
- Follows existing authorization patterns (similar to library permissions)
- Uses established middleware (`requireAuth`)
- Maintains consistency with existing database architecture
- Uses the established tech stack (Lucide icons, Tailwind CSS)
- Follows existing API endpoint patterns and error handling
