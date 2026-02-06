# Streaming Implementation Summary

## Overview

Implemented a full media streaming pipeline across four phases, bringing Moss to feature parity with Plex/Jellyfin's streaming behavior for a personal media server on a Synology NAS.

## What Was Built

### Phase 1: Video Metadata & Codec Detection

Extracts and stores video metadata using `ffprobe` during library scans.

**Files:**
- `src/lib/server/scanner/probe.ts` — `probeMediaFile()` spawns ffprobe, parses JSON output for duration, resolution, codecs, container, bitrate
- `src/lib/server/db/schema.ts` — Schema v8 with new media columns: `duration`, `width`, `height`, `video_codec`, `audio_codec`, `container_format`, `bitrate`
- `src/lib/server/db/migrations.ts` — Migration v8 (up/down) for the new columns
- `src/lib/server/db/types.ts` — Updated `Media` interface with nullable metadata fields
- `src/lib/server/scanner/library-scanner.ts` — Probes video files on insert/update, backfills existing media via `probeUnprobedMedia()`
- `src/lib/utils/format.ts` — `formatDuration()` and `formatBitrate()` utilities
- `src/lib/components/MediaDetailModal.svelte` — Displays metadata in the info panel

### Phase 2: Direct Stream & Container Remuxing

Remuxes all browser-compatible videos to fragmented MP4 on-the-fly for instant playback.

**Files:**
- `src/lib/server/streaming/remux.ts` — Core streaming decision logic:
  - `getStreamDecision()` — determines `direct`, `remux`, or `transcode` based on codec/container
  - `createRemuxStream()` — spawns `ffmpeg -c copy -movflags frag_keyframe+empty_moov+default_base_moof` piping to stdout
  - Browser-compatible codecs: H.264, VP9, AV1 (video) / AAC, MP3, Opus, FLAC (audio)
- `src/routes/api/media/[id]/file/+server.ts` — Rewritten with streaming decision logic

**Design decision:** Remux *all* compatible videos (including MP4s) rather than detecting moov atom position. The `-c copy` remux is near-zero CPU cost, making it cheaper than the complexity of moov detection.

### Phase 3: On-the-Fly Transcoding

Re-encodes incompatible codecs to H.264/AAC with quality presets and caching.

**Files:**
- `src/lib/server/streaming/transcode.ts` — Full transcoding pipeline:
  - Quality presets: `high` (1080p/8Mbps), `medium` (720p/4Mbps), `low` (480p/1.5Mbps)
  - `createTranscodeStream()` — spawns ffmpeg with libx264/AAC encoding, streams to stdout while simultaneously writing to cache
  - Cache stored in `{metadataDir}/transcode-cache/{mediaId}-{quality}.mp4`
  - Shared transcode queue (max 1 concurrent) via `reserveTranscodeSlot()`/`releaseTranscodeSlot()`
  - Partial cache cleanup on failure
- `src/routes/api/media/[id]/qualities/+server.ts` — Returns available quality presets based on source resolution
- `src/routes/api/media/[id]/file/+server.ts` — Updated with `?quality=` parameter support and transcode/cache serving

### Phase 4: HLS Segmented Streaming

Adaptive bitrate streaming for transcoded content via HLS.

**Files:**
- `src/lib/server/streaming/hls.ts` — HLS segment generation and caching:
  - `generateMasterPlaylist()` — builds M3U8 with quality variants, bandwidth, resolution
  - `startHlsGeneration()` — spawns ffmpeg to produce `.ts` segments and `.m3u8` playlist
  - Segments cached in `{metadataDir}/hls-cache/{mediaId}/{quality}/`
  - Shares the transcode queue with Phase 3
  - Progressive playlist serving (partial playlists while generating)
- `src/routes/api/media/[id]/stream/master.m3u8/+server.ts` — Master playlist endpoint
- `src/routes/api/media/[id]/stream/[quality]/playlist.m3u8/+server.ts` — Variant playlist endpoint (triggers generation on first request)
- `src/routes/api/media/[id]/stream/[quality]/[segment]/+server.ts` — Segment serving endpoint
- `src/lib/components/MediaDetailModal.svelte` — Integrated hls.js for adaptive playback; Safari native HLS support; quality selector dropdown

**Dependency added:** `hls.js` (lightweight HLS player for browsers)

## Streaming Decision Flow

```
Video request arrives
│
├─ media_type !== 'video' → serve raw file (images, etc.)
│
├─ ?quality= specified (non-original) → transcode or serve from cache
│
├─ getStreamDecision():
│   ├─ 'remux' (compatible codecs) → ffmpeg -c copy → fragmented MP4 stream
│   ├─ 'transcode' (incompatible codecs) → HLS or direct transcode
│   └─ 'direct' (no metadata) → serve raw file
│
└─ fallback → serve raw file with range request support
```

## Module Structure

```
src/lib/server/streaming/
├── index.ts        — barrel exports
├── remux.ts        — stream decision logic + remux streaming
├── transcode.ts    — quality presets, transcode queue, cache, encoding
└── hls.ts          — HLS playlist generation, segment caching
```

## Tests

101 tests across 7 test files:

| Test File | Tests | Coverage |
|---|---|---|
| `format.test.ts` | 10 | `formatDuration`, `formatBitrate` |
| `migrations.test.ts` | 8 | Schema v8 up/down migration |
| `library-scanner.test.ts` | 8 | Probe integration, backfill |
| `probe.test.ts` | 9 | ffprobe parsing, error handling |
| `remux.test.ts` | 21 | Stream decisions, ffmpeg args |
| `transcode.test.ts` | 23 | Quality presets, cache, queue management |
| `hls.test.ts` | 22 | Master playlist, segments, job tracking |

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/media/[id]/file` | Serve media (remux/transcode/raw) |
| `GET /api/media/[id]/file?quality=medium` | Serve at specific quality |
| `GET /api/media/[id]/qualities` | Available quality presets + HLS URL |
| `GET /api/media/[id]/stream/master.m3u8` | HLS master playlist |
| `GET /api/media/[id]/stream/[quality]/playlist.m3u8` | HLS variant playlist |
| `GET /api/media/[id]/stream/[quality]/[segment]` | HLS segment |

## Cache Layout

```
{metadataDir}/
├── transcode-cache/
│   ├── {mediaId}-high.mp4
│   ├── {mediaId}-medium.mp4
│   └── {mediaId}-low.mp4
└── hls-cache/
    └── {mediaId}/
        └── {quality}/
            ├── playlist.m3u8
            ├── segment-000.ts
            ├── segment-001.ts
            └── ...
```
