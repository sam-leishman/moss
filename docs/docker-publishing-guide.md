---
description: How to publish Moss Docker images to GitHub Container Registry
---

# Publishing Docker Images to GHCR

This guide explains how to publish your Moss Docker image to GitHub Container Registry (GHCR) using the automated workflow.

## What the Workflow Does

The workflow automatically builds and publishes your Docker image when:
- You push to the `main` branch
- You create a new tag (like `v1.0.0`)
- You manually trigger it from the Actions tab
- A pull request is opened (builds but doesn't push)

## Easy Steps to Publish

### 1. **First Time Setup** (One-time only)

No special setup needed! GitHub automatically provides the `GITHUB_TOKEN` secret with the right permissions.

However, you need to ensure your repository allows GitHub Actions to write to packages:

1. Go to your repository on GitHub
2. Click **Settings** → **Actions** → **General**
3. Scroll to "Workflow permissions"
4. Select **"Read and write permissions"**
5. Click **Save**

### 2. **Publish Your First Image**

Choose one of these methods:

#### Method A: Push to main branch
```bash
git add .
git commit -m "Your changes"
git push origin main
```

The workflow will automatically run and publish your image.

#### Method B: Create a version tag (recommended for releases)
```bash
git tag v0.0.1
git push origin v0.0.1
```

This creates a versioned image like `ghcr.io/your-username/moss:v0.0.1`

#### Method C: Manual trigger
1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click **Build and Publish Docker Image** workflow
4. Click **Run workflow** button
5. Select the branch and click **Run workflow**

### 3. **Monitor the Build**

1. Go to the **Actions** tab in your GitHub repository
2. Click on the running workflow
3. Watch the build progress in real-time
4. If it fails, check the logs for errors

### 4. **Find Your Published Image**

After successful build:

1. Go to your repository main page
2. Look for **Packages** section on the right sidebar
3. Click on your package name (moss)
4. You'll see all published versions

The image URL will be: `ghcr.io/your-username/moss:tag`

### 5. **Pull and Use Your Image**

First, authenticate with GHCR:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u your-username --password-stdin
```

Then pull your image:
```bash
docker pull ghcr.io/your-username/moss:latest
```

Or use it in docker-compose:
```yaml
services:
  moss:
    image: ghcr.io/your-username/moss:latest
    # ... rest of your config
```

## Understanding Image Tags

The workflow automatically creates these tags:

- `latest` - Always points to the most recent main branch build
- `main` - Latest build from main branch
- `v1.0.0` - Specific version tags you create
- `v1.0` - Major.minor version
- `v1` - Major version only
- `sha-abc123` - Specific commit SHA

## Making Your Image Public (Optional)

By default, your image is private. To make it public:

1. Go to your repository's **Packages** section
2. Click on your package (moss)
3. Click **Package settings**
4. Scroll to "Danger Zone"
5. Click **Change visibility** → **Public**

## Troubleshooting

### Build fails with permission error
- Check that "Read and write permissions" is enabled in Settings → Actions → General

### Can't find the image after build
- Make sure the workflow completed successfully (green checkmark)
- Check the Packages section on your repository page

### Image is too large
- The workflow uses your existing multi-stage Dockerfile which is already optimized
- Consider adding `.dockerignore` to exclude unnecessary files

## Next Steps

- Create a release tag when ready: `git tag v1.0.0 && git push origin v1.0.0`
- Update your `docker-compose.yml` to use the GHCR image
- Share the image URL with others who need to use Moss
