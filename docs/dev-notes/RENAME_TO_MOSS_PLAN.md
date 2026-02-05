# Rename Plan: XView → Moss

**Date**: February 4, 2026  
**Status**: Planning Phase

---

## Overview

This document outlines the complete process for renaming the application from "XView" to "Moss", including git repository, folder structure, and all code references.

---

## Phase 1: Git Repository & Folder Rename

### Git Repository Rename (Remote)

**If using GitHub/GitLab/Bitbucket:**
1. Navigate to repository settings on your hosting platform
2. Rename repository from `xview` to `moss`
3. Update repository description if it mentions "xview"
4. Note: Git hosting platforms automatically set up redirects from old URL to new URL

**Important Considerations:**
- ⚠️ **Collaborators**: Notify any collaborators about the rename
- ⚠️ **CI/CD**: Update any CI/CD pipelines that reference the old repo name
- ⚠️ **Webhooks**: Update any webhooks pointing to the old repository URL
- ⚠️ **Documentation**: Update any external documentation linking to the repo

### Local Git Configuration

After renaming the remote repository:

```bash
# Update remote URL (if needed - hosting platforms usually handle this)
cd /Users/samleishman/WebstormProjects/personal/xview
git remote set-url origin <new-repo-url>

# Verify the change
git remote -v
```

### Local Folder Rename

**Steps:**
1. Close your IDE completely
2. Rename the folder from `xview` to `moss`:
   ```bash
   cd /Users/samleishman/WebstormProjects/personal
   mv xview moss
   ```
3. Reopen the project in your IDE from the new location
4. Update any IDE-specific workspace configurations if needed

**Important Considerations:**
- ⚠️ **Terminal sessions**: Close any terminal sessions with `cd` into the old path
- ⚠️ **IDE recent projects**: Your IDE may still show the old path - reopen from new location
- ⚠️ **Symlinks**: Check for any symlinks pointing to the old path
- ⚠️ **Backup scripts**: Update any backup or sync scripts referencing the old path

---

## Phase 2: Code Refactoring

### Files Requiring Changes

#### 1. **Package Configuration**
- **File**: `package.json`
- **Line**: 2
- **Change**: `"name": "xview"` → `"name": "moss"`

#### 2. **Docker Configuration**
- **File**: `docker-compose.yml`
- **Lines**: 4, 5, 6, 10, 11, 12
- **Changes**:
  - Service name: `xview:` → `moss:`
  - Image: `image: xview:latest` → `image: moss:latest`
  - Container: `container_name: xview` → `container_name: moss`
  - Volume paths: `/volume1/xview/media` → `/volume1/moss/media`
  - Volume paths: `/volume1/docker/xview/config` → `/volume1/docker/moss/config`
  - Volume paths: `/volume1/docker/xview/metadata` → `/volume1/docker/moss/metadata`

#### 3. **Docker Documentation**
- **File**: `DOCKER.md`
- **Lines**: 8, 20, 21
- **Changes**:
  - Build command: `docker build -t xview:latest .` → `docker build -t moss:latest .`
  - Volume example: `/volume1/xview/media` → `/volume1/moss/media`
  - Volume example: `/volume1/docker/xview/config` → `/volume1/docker/moss/config`

#### 4. **README**
- **File**: `README.md`
- **Line**: 18
- **Change**: Command ending with `xview` → `moss`

#### 5. **Style Guide**
- **File**: `STYLE_GUIDE.md`
- **Lines**: 1, 3
- **Changes**:
  - Title: `# XView Style Guide` → `# Moss Style Guide`
  - Description: "XView application" → "Moss application"

#### 6. **Development Guide**
- **File**: `dev-notes/DEVELOPMENT_GUIDE.md`
- **Lines**: 1, 5, 26, 133
- **Changes**:
  - Title: `# XView Development Guide` → `# Moss Development Guide`
  - "What XView Is:" → "What Moss Is:"
  - Database comment: `xview.db` → `moss.db`
  - Database path: `$CONFIG_DIR/xview.db` → `$CONFIG_DIR/moss.db`

#### 7. **UI Components**
- **File**: `src/routes/+layout.svelte`
- **Line**: 89
- **Change**: `<h1>XView</h1>` → `<h1>Moss</h1>`

- **File**: `src/routes/login/+page.svelte`
- **Line**: 44
- **Change**: `<h1>XView</h1>` → `<h1>Moss</h1>`

#### 8. **Database Files**
- **File**: `src/lib/server/db/connection.ts`
- **Lines**: 18, 42
- **Changes**:
  - Database filename: `'xview.db'` → `'moss.db'`
  - Database filename: `'xview.db'` → `'moss.db'`

- **File**: `src/lib/server/db/README.md`
- **Lines**: 3, 37, 38
- **Changes**:
  - Description: "for XView" → "for Moss"
  - Dev path: `./test-config/xview.db` → `./test-config/moss.db`
  - Prod path: `$CONFIG_DIR/xview.db` → `$CONFIG_DIR/moss.db`

#### 9. **API Endpoints**
- **File**: `src/routes/api/backup/+server.ts`
- **Line**: 31
- **Change**: Backup filename prefix: `xview-backup-` → `moss-backup-`

- **File**: `src/routes/api/backup/list/+server.ts`
- **Line**: 22
- **Change**: Filter prefix: `'xview-backup-'` → `'moss-backup-'`

- **File**: `src/routes/api/backup/delete/+server.ts`
- **Line**: 29
- **Change**: Database check: `'xview.db'` → `'moss.db'`

- **File**: `src/routes/settings/data/+page.svelte`
- **Line**: 290
- **Change**: Export filename: `xview-export-` → `moss-export-`

#### 10. **Server Module READMEs**
- **File**: `src/lib/server/thumbnails/README.md`
- **Line**: 3
- **Change**: "in XView" → "in Moss"

- **File**: `src/lib/server/logging/README.md`
- **Line**: 3
- **Change**: "for XView" → "for Moss"

- **File**: `src/lib/server/scanner/README.md`
- **Line**: 3
- **Change**: "for XView" → "for Moss"

- **File**: `src/lib/server/errors/README.md`
- **Line**: 3
- **Change**: "for XView" → "for Moss"

- **File**: `src/lib/server/security/README.md`
- **Line**: 3
- **Change**: "for XView" → "for Moss"

#### 11. **Development Notes**
- **File**: `dev-notes/likes/implementation-summary.md`
- **Lines**: 4, 221, 231
- **Changes**: All references "XView" → "Moss"

- **File**: `dev-notes/likes/LIKE_FEATURE_PLAN.md`
- **Line**: Check for any "XView" references

- **File**: `dev-notes/auth/implementation-complete.md`
- **Lines**: 1, 10, 426, 537
- **Changes**: All references "XView" → "Moss"

- **File**: `dev-notes/auth/USER_AUTHENTICATION_PLAN.md`
- **Line**: Check for any "XView" references

---

## Phase 3: Docker Volume Migration (Production)

**⚠️ CRITICAL: Only perform this on your Synology NAS if you have existing production data**

### Before Migration
1. **Stop the container**:
   ```bash
   docker-compose down
   ```

2. **Backup everything**:
   ```bash
   # On Synology NAS
   cp -r /volume1/xview /volume1/xview-backup
   cp -r /volume1/docker/xview /volume1/docker/xview-backup
   ```

### Migration Steps
1. **Rename volume directories**:
   ```bash
   # On Synology NAS
   mv /volume1/xview /volume1/moss
   mv /volume1/docker/xview /volume1/docker/moss
   ```

2. **Rebuild Docker image with new name**:
   ```bash
   docker build -t moss:latest .
   ```

3. **Start with new configuration**:
   ```bash
   docker-compose up -d
   ```

4. **Verify**:
   - Check container logs: `docker logs moss`
   - Access the application and verify data is intact
   - Check database path inside container: `docker exec moss ls -la /config`

5. **Cleanup old image** (after verification):
   ```bash
   docker rmi xview:latest
   ```

---

## Phase 4: Database File Rename (Development)

**For local development environment:**

```bash
# Navigate to test-config directory
cd /Users/samleishman/WebstormProjects/personal/moss/test-config

# Rename database file if it exists
if [ -f xview.db ]; then
  mv xview.db moss.db
  # Also rename WAL and SHM files if they exist
  [ -f xview.db-wal ] && mv xview.db-wal moss.db-wal
  [ -f xview.db-shm ] && mv xview.db-shm moss.db-shm
fi
```

---

## Execution Order

### Recommended Sequence:

1. ✅ **Commit all pending changes** to git
2. ✅ **Create a backup** of the entire project
3. ✅ **Phase 2**: Execute all code refactoring changes
4. ✅ **Test locally**: Run `pnpm dev` and verify everything works
5. ✅ **Phase 4**: Rename local database files
6. ✅ **Test again**: Verify database connection works
7. ✅ **Commit changes**: `git commit -m "Rename application from XView to Moss"`
8. ✅ **Phase 1**: Rename git repository (remote first, then update local)
9. ✅ **Phase 1**: Rename local folder
10. ✅ **Push changes**: `git push origin main`
11. ✅ **Phase 3**: If deploying to production, perform Docker volume migration on NAS

---

## Testing Checklist

After completing the rename:

- [ ] Application starts without errors (`pnpm dev`)
- [ ] Database connection works (check logs)
- [ ] Login page displays "Moss" branding
- [ ] Main layout displays "Moss" in header
- [ ] Docker build succeeds: `docker build -t moss:latest .`
- [ ] Docker container starts: `docker-compose up`
- [ ] Database backups use new filename prefix (`moss-backup-`)
- [ ] Data export uses new filename prefix (`moss-export-`)
- [ ] All existing data is accessible
- [ ] User authentication works
- [ ] Media scanning works
- [ ] Thumbnails generate correctly

---

## Rollback Plan

If issues occur:

1. **Code changes**: `git revert <commit-hash>`
2. **Folder rename**: Rename back to `xview`
3. **Database files**: Rename back to `xview.db`
4. **Docker volumes**: Restore from backup directories
5. **Git repository**: Rename back through hosting platform settings

---

## Notes

- **Case sensitivity**: "Moss" vs "moss" - Use "Moss" for UI display, "moss" for technical identifiers
- **Database migration**: The database filename change is backward compatible - no schema changes needed
- **Existing backups**: Old backup files with `xview-backup-` prefix will still be readable
- **Search indexing**: If you have any external search/indexing tools, update them to reference "moss"
- **Browser bookmarks**: Users will need to update their bookmarks if domain/path changes

---

## Summary

**Total files to modify**: 23 files
**Estimated time**: 30-45 minutes
**Risk level**: Low (mostly string replacements, no schema changes)
**Reversibility**: High (can be rolled back easily)

The rename is straightforward and low-risk. The most critical part is ensuring Docker volume paths are updated correctly in production environments to avoid data loss.
