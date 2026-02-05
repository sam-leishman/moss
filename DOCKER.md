# Docker Deployment

This application is designed to run as a Docker container on Synology NAS, similar to Jellyfin or Audiobookshelf.

## Building the Image

```bash
docker build -t moss:latest .
```

## Security Features

- **Non-root user**: Container runs as user `moss` with configurable UID/GID
- **Health checks**: Built-in health monitoring via `/api/health` endpoint
- **Minimal image**: Production stage excludes build dependencies
- **Image metadata**: OCI-compliant labels for version tracking

## Deployment on Synology

1. Build the Docker image (locally or on NAS)
2. In Container Manager, create a new project
3. Copy `docker-compose.example.yml` to `docker-compose.yml`
4. Adjust volumes and timezone to match your setup
5. Deploy the container

## Volume Mounts

- `/media` - Read-only media files (e.g., `/volume1/moss/media`)
- `/config` - Persistent configuration and database (e.g., `/volume1/docker/moss/config`)
- `/metadata` - Cached metadata and thumbnails (e.g., `/volume1/docker/moss/metadata`)

**Note**: Use `PUID` and `PGID` environment variables to match your host user's permissions. Default is 1000:1000.

## Important Development Notes

- **Use environment variables for all file paths** - Never hardcode absolute paths
- **Store persistent data in `/config`** - This survives container restarts
- **Access media from `/media`** - This will be mounted from Synology
- **Use streams for large files** - Don't load entire media files into memory
- **Port 3000** is exposed by default

## Configuration

All configuration is done via `docker-compose.yml`. No `.env` file is needed for Docker deployment.

The `.env.example` file is only for local development with `pnpm dev`.

## User/Group Permissions

The container runs as a non-root user with configurable UID/GID:

```yaml
environment:
  - PUID=1000  # Your user ID
  - PGID=1000  # Your group ID
```

To find your user/group ID on Synology:
```bash
id your-username
```

## Health Check

The container includes a health check that monitors the `/api/health` endpoint:
- Interval: 30 seconds
- Timeout: 3 seconds
- Start period: 5 seconds
- Retries: 3

Check container health with:
```bash
docker inspect --format='{{.State.Health.Status}}' moss
```
