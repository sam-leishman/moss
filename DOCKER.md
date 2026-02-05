# Docker Deployment

This application is designed to run as a Docker container on Synology NAS, similar to Jellyfin or Audiobookshelf.

## Building the Image

```bash
docker build -t moss:latest .
```

## Deployment on Synology

1. Build the Docker image (locally or on NAS)
2. In Container Manager, create a new project
3. Use the `docker-compose.yml` as a template
4. Adjust volumes and timezone as needed

## Volume Mounts

- `/media` - Read-only media files (e.g., `/volume1/moss/media`)
- `/config` - Persistent configuration and database (e.g., `/volume1/docker/moss/config`)

## Important Development Notes

- **Use environment variables for all file paths** - Never hardcode absolute paths
- **Store persistent data in `/config`** - This survives container restarts
- **Access media from `/media`** - This will be mounted from Synology
- **Use streams for large files** - Don't load entire media files into memory
- **Port 3000** is exposed by default

## Configuration

All configuration is done via `docker-compose.yml`. No `.env` file is needed for Docker deployment.

The `.env.example` file is only for local development with `pnpm dev`.
