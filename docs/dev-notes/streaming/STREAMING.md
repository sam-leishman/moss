# Video Streaming Architecture

## Overview

Moss serves video files over HTTP with full seeking support. The streaming pipeline handles three categories of video files, all converging on the same serving pattern: cached MP4 files with HTTP Range requests.

| Source | Processing | Cache | Serving |
|--------|-----------|-------|---------|
| MP4 + H.264/AAC | None | N/A (serve original) | `serveRawFile` with Range |
| MKV/AVI + H.264/AAC | Remux (`-c copy`, seconds) | `remux-cache/{id}.mp4` | `serveRawFile` with Range |
| Incompatible codecs (HEVC, etc.) | Transcode (H.264/AAC, minutes) | `transcode-cache/{id}-{quality}.mp4` | `serveRawFile` with Range |

---

## How It Works

### Stream Decision Flow

```
Video request → getStreamDecision(codec, audio, container)
│
├─ 'direct'    → MP4 with compatible codecs → serve original file with Range support
├─ 'remux'     → Compatible codecs, wrong container → serve cached remux or pipe stream
└─ 'transcode' → Incompatible codecs → serve cached transcode or pipe stream
```

### Background Caching

The library scanner runs `prepareVideoCache()` after probing each video. This kicks off background remux/transcode jobs so cached files are ready before the user hits play.

- **Remux jobs** are fast (seconds, `-c copy`) and can run concurrently.
- **Transcode jobs** are slow (minutes, `libx264`/`aac`) and use `-preset ultrafast` with `-movflags +faststart` for proper seeking.
- Background transcode jobs are tracked separately from live-stream transcode slots so they don't block on-demand playback.

### First-Play Fallback

If a user plays a video before the cache is ready:

- **Remux:** Streams via ffmpeg pipe while cache builds in background. Fast enough that the cache is usually ready within seconds.
- **Transcode:** Streams via ffmpeg pipe with fragmented MP4 flags for immediate playback. **Seeking is disabled** until the background cache completes. A UI indicator ("Preparing for seeking...") shows in the player. Once the cache is ready, the video source reloads seamlessly at the current playback position.

### Cache Invalidation

When a source file changes on disk, the scanner calls `invalidateRemuxCache()` and `invalidateTranscodeCache()` to delete stale cached files. The next scan or play triggers re-caching.

---

## Module Structure

```
src/lib/server/streaming/
├── index.ts        — barrel exports
├── remux.ts        — stream decision logic, remux streaming, remux cache
└── transcode.ts    — quality presets, transcode queue, transcode cache, background jobs
```

### Key Functions

**remux.ts:**
- `getStreamDecision()` — determines `direct`, `remux`, or `transcode`
- `createRemuxStream()` — pipes ffmpeg `-c copy` to stdout for live streaming
- `startRemuxToCache()` — background remux to cached MP4 with `+faststart`
- `hasRemuxCache()` / `invalidateRemuxCache()` / `getRemuxCachePath()`

**transcode.ts:**
- `getAvailableQualities()` — returns quality presets available for source resolution
- `createTranscodeStream()` — live pipe transcode for immediate playback (no seeking)
- `startTranscodeToCache()` — background transcode to cached MP4 with `+faststart` and `ultrafast` preset
- `hasTranscodeCache()` / `invalidateTranscodeCache()` / `getTranscodeCachePath()`
- `isTranscoding()` — checks if a background job is in progress
- `canStartTranscode()` / `reserveTranscodeSlot()` / `releaseTranscodeSlot()` — live-stream queue (max 1 concurrent)

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/media/[id]/file` | Serve media (direct/remux/transcode) |
| `GET /api/media/[id]/file?quality=high` | Serve at specific transcode quality |
| `GET /api/media/[id]/qualities` | Available qualities, cache status per quality |

### Qualities Response

```json
{
  "qualities": ["original", "high", "medium"],
  "needsTranscode": false,
  "cached": { "original": true, "high": true, "medium": false },
  "sourceCodec": "h264",
  "sourceResolution": "1920x1080"
}
```

The `cached` field tells the client whether seeking is available for each quality. The client polls this endpoint while a transcode is in progress.

---

## Quality Presets

| Preset | Resolution | Video Bitrate | Audio Bitrate |
|--------|-----------|---------------|---------------|
| high | 1080p | 8 Mbps | 192 kbps |
| medium | 720p | 4 Mbps | 128 kbps |
| low | 480p | 1.5 Mbps | 96 kbps |

Only presets at or below the source resolution are offered.

---

## Client Components

**`MediaDetailModal.svelte`** — Fetches available qualities, polls cache status, manages video source. When cache becomes ready mid-playback, seamlessly reloads the video at the current position.

**`VideoPlayer.svelte`** — Displays playback controls, seek bar, quality selector. When `isSeekable` is false: disables the seek bar (dimmed, `cursor-not-allowed`), blocks arrow key seeks, and shows a "Preparing for seeking..." indicator in the top-left corner.

---

## Cache Layout

```
{metadataDir}/
├── remux-cache/
│   └── {mediaId}.mp4
└── transcode-cache/
    ├── {mediaId}-high.mp4
    ├── {mediaId}-medium.mp4
    └── {mediaId}-low.mp4
```

---

## Design History

The streaming architecture went through several iterations before arriving at the current background caching approach.

### Phase 1-3: Metadata, Remux, Transcode (Successful)

Built the core pipeline: ffprobe metadata extraction during library scan, on-the-fly remuxing for compatible codecs in wrong containers, and transcoding for incompatible codecs with quality presets and caching.

### Phase 4: HLS Streaming (Failed)

Implemented HLS (HTTP Live Streaming) with hls.js for transcoded content. This used segmented `.ts` files with `.m3u8` playlists.

**Why it failed:** HLS VOD playlists assume all segments exist or can be fetched independently. Our on-demand generation used a single sequential FFmpeg job. When hls.js probed end-of-stream segments during seeking, it killed the active job, breaking playback of subsequent segments. Even Jellyfin has the same unsolved problem with this architecture.

Six attempts were made to fix HLS seeking (custom loaders, buffer tuning, ABR disabling, pre-generation, EVENT playlists, request filtering). None worked because the issue was a fundamental architectural mismatch.

### Progressive Streaming Attempt (Failed)

Tried replacing HLS with progressive streaming using Range requests and FFmpeg `-ss` seeking, similar to the working remux pattern.

**Why it failed:** Live transcoding cannot return valid HTTP 206 Partial Content responses because the total content length is unknown. Without proper `Content-Range` headers, browsers treat the response as a full file, causing seeks to appear to restart the video.

### Background Caching (Current — Successful)

The key insight: separate immediate playback from seeking. Stream via pipe for instant playback (no seeking), while building a proper cached MP4 in the background. Once the cache is complete, serve it with full Range support. The UI indicates when seeking becomes available and seamlessly transitions.

This approach avoids both the HLS architectural mismatch and the progressive streaming 206 limitation. HLS was completely removed (hls.js dependency, hls.ts, all stream routes, all client HLS code).
