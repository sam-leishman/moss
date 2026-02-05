---
description: How to deploy Moss Docker image on Synology Container Manager
---

# Setting Up Moss on Synology Container Manager

This guide walks you through deploying your Moss Docker image on a Synology NAS using Container Manager.

## Prerequisites

- Synology NAS with Container Manager installed (from Package Center)
- Your Moss image published to GHCR: `ghcr.io/your-username/moss:latest`
- Admin access to your Synology NAS

## Step 1: Install Container Manager

1. Open **Package Center** on your Synology
2. Search for "Container Manager"
3. Click **Install** if not already installed
4. Launch Container Manager from the main menu

## Step 2: Configure GHCR Authentication

Since your image is on GitHub Container Registry, you need to authenticate:

1. In Container Manager, go to **Registry** tab
2. Click **Settings** (gear icon)
3. Click **Add Registry**
4. Fill in the details:
   - **Registry URL**: `ghcr.io`
   - **Username**: Your GitHub username
   - **Password**: Your GitHub Personal Access Token (see below)
5. Click **Test Connection** to verify
6. Click **Apply**

### Creating a GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click **Generate new token** → **Generate new token (classic)**
3. Give it a name like "Synology Container Manager"
4. Set expiration (recommended: 90 days)
5. Check the box for **read:packages** scope
6. Click **Generate token**
7. Copy the token immediately (you won't see it again)

## Step 3: Pull Your Moss Image

1. In Container Manager, go to **Registry** tab
2. You should see `ghcr.io` in your registries
3. Click on `ghcr.io` and search for `your-username/moss`
4. Select the image and choose the tag (usually `latest`)
5. Click **Download**
6. Wait for the image to download

## Step 4: Create the Container

### Method A: Using the GUI (Recommended for beginners)

1. Go to **Container** tab
2. Click **Create** → **Create Container**
3. **Image Selection**:
   - Select your downloaded `ghcr.io/your-username/moss:latest` image
   - Click **Next**

4. **Container Settings**:
   - **Container name**: `moss`
   - Click **Advanced Settings**

5. **Advanced Settings**:

   **Port Settings**:
   - Click **Add**
   - **Local Port**: `3000` (or any unused port)
   - **Container Port**: `3000`
   - **Protocol**: `TCP`
   - Click **Apply**

   **Volume Settings** (for data persistence):
   - Click **Add Folder**
   - **File/Folder**: Create a shared folder like `docker/moss`
   - **Mount path**: `/app/data` (where Moss stores data)
   - Click **Apply**

   **Environment Variables**:
   - Click **Add Variable**
   - **Variable**: `NODE_ENV`
   - **Value**: `production`
   - Click **Apply**

6. Click **Apply** to create the container

### Method B: Using docker-compose.yml (Advanced)

Create a `docker-compose.yml` file in a shared folder:

```yaml
version: '3.8'

services:
  moss:
    image: ghcr.io/your-username/moss:latest
    container_name: moss
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - /volume1/docker/moss/data:/app/data
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

1. In Container Manager, go to **Project** tab
2. Click **Create** → **Create Project**
3. Select your shared folder containing the docker-compose.yml
4. Click **Next** and **Apply**

## Step 5: Configure Firewall (if needed)

1. Go to **Control Panel** → **Security** → **Firewall**
2. Click **Edit Rules**
3. Click **Create** → **Create Rule**
4. **Rule Type**: Custom
5. **Ports**: `3000`
6. **Protocol**: TCP
7. **Source**: All (or specific IPs for security)
8. **Action**: Allow
9. Click **OK** and **Save**

## Step 6: Access Your Moss Instance

1. Open your web browser
2. Navigate to `http://your-synology-ip:3000`
3. You should see the Moss interface
4. Complete the initial setup if prompted

## Step 7: Set Up Reverse Proxy (Optional but Recommended)

For a cleaner URL like `moss.yourdomain.com`:

1. Install **Web Station** from Package Center
2. Go to **Control Panel** → **Login Portal** → **Advanced**
3. Click **Reverse Proxy** → **Create**
4. Fill in:
   - **Description**: Moss
   - **Hostname**: `moss.yourdomain.com`
   - **Protocol**: HTTP
   - **Backend server**: `localhost`
   - **Backend port**: `3000`
5. Click **OK**

## Troubleshooting

### Container won't start
1. Check the container logs in Container Manager
2. Verify the image downloaded correctly
3. Check if port 3000 is already in use

### Can't access the web interface
1. Verify the firewall allows port 3000
2. Check if the container is running
3. Try accessing via IP: `http://192.168.1.100:3000`

### Data not persisting
1. Ensure you mounted the volume correctly
2. Check the shared folder permissions
3. Verify the mount path matches what Moss expects

### Image pull fails
1. Verify your GHCR authentication is working
2. Check if your GitHub token has the right permissions
3. Ensure the image name and tag are correct

## Maintenance

### Updating Moss
1. Pull the new image: In Registry tab, select your image and click **Download**
2. Stop the current container
3. Delete the old container (data remains in volume)
4. Create a new container with the updated image
5. Start the new container

### Backups
1. Back up the shared folder: `/volume1/docker/moss/`
2. Export container configuration if using docker-compose

## Performance Tips

- **RAM**: Allocate at least 512MB to the container
- **CPU**: 2 cores recommended for better performance
- **Storage**: Use SSD for better database performance
- **Network**: Use wired connection for better stability

Your Moss instance should now be running smoothly on your Synology NAS!
