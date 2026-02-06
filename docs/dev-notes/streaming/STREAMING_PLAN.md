# Streaming Performance Plan

## Why Videos Load Slowly (And Why Plex/Jellyfin Don't)

You're not imagining things — and no, Plex isn't secretly reducing your quality. Most of the time Plex and Jellyfin stream at **full original quality** and it's still dramatically faster than browsing the file system directly. The reasons are more subtle than just "transcoding."

### 1. HTTP Streaming vs File-Sharing Protocols

This is the biggest factor. When you browse your NAS remotely via SMB, AFP, or Synology File Station, you're using **file-sharing protocols** that were designed for LAN use. They're chatty — lots of small reads, metadata lookups, lock negotiations, and round-trips. Every operation has latency overhead that compounds over a remote connection.

Media servers like Plex serve files over **HTTP**, which is purpose-built for this. One request, one continuous stream of bytes, no protocol chatter. HTTP is what the entire internet runs on for a reason — it's optimized for exactly this kind of sequential data delivery over high-latency connections. This alone accounts for most of the speed difference you're seeing, even at identical quality.

### 2. Optimized MP4 Structure (Fast-Start / moov Atom)

MP4 files have a metadata block called the **moov atom** that contains the index of all frames, timestamps, and codec info. Many encoders write this at the **end** of the file. When a browser encounters this, it makes a range request to the end of the file to fetch the moov atom, then seeks back to the beginning to start playback. On a local network this is barely noticeable, but over a remote connection each extra round-trip adds real latency — often several seconds of staring at a loading spinner before anything plays.

Media servers ensure the moov atom is at the **beginning** of the stream (called "fast-start"), so the player has everything it needs from the first bytes. For fragmented MP4 output, there's no moov atom problem at all — each fragment is self-contained.

### 3. Direct Play & Container Remuxing

Plex's default behavior is **direct play** — serve the original file byte-for-byte over HTTP when the codec and container are already compatible. No quality loss, no CPU cost, just efficient HTTP delivery.

When the codec is compatible but the container isn't (e.g., H.264/AAC inside a `.mkv` file), Plex **remuxes** — repackages the streams into an MP4 container on-the-fly. This is a copy operation with near-zero CPU cost and **zero quality loss**. The video and audio bits are identical; only the wrapper changes.

### 4. Transcoding (The Fallback)

Full transcoding — actually re-encoding the video at a different bitrate or resolution — is the **last resort**, not the default. It kicks in when:
- The video codec is incompatible with the client (e.g., HEVC on a browser that doesn't support it)
- The user explicitly selects a lower quality
- Bandwidth is detected as insufficient for the original bitrate

When it does happen, it's powerful: a 50 Mbps 4K file transcoded to 4 Mbps 720p is a 12x reduction in data. But for most playback on a decent connection, Plex never touches the video data at all.

### 5. HLS Segmented Streaming

For transcoded content (not direct play), Plex and Jellyfin use **HTTP Live Streaming (HLS)** — the video is split into small segments (2–10 seconds each) and served via a playlist. This enables:
- Playback starting after just the first segment downloads
- Mid-stream quality switching if bandwidth changes
- Fast seeking by jumping to the segment at the target timestamp

For direct play of compatible files, HLS isn't typically used — plain HTTP with range requests is sufficient and simpler.

---

## Where Moss Stands Today

| Capability | Status |
|---|---|
| HTTP streaming (vs SMB/file protocols) | ✅ Already have this — it's the #1 factor |
| HTTP Range requests (byte-range streaming) | ✅ Already implemented |
| Thumbnail generation (ffmpeg + sharp) | ✅ Already implemented |
| ffmpeg available in Docker image | ✅ Already available |
| Codec/container detection | ❌ Not implemented |
| Video metadata (duration, resolution, codec) | ❌ Not stored |
| Fast-start MP4 / fragmented MP4 output | ❌ Not handled |
| Container remuxing (MKV → MP4) | ❌ Not implemented |
| Browser-incompatible format handling | ❌ `.mkv`, `.avi` served raw — won't play |
| Video transcoding | ❌ Not implemented |
| HLS segmented streaming | ❌ Not implemented |

The current file endpoint (`/api/media/[id]/file`) streams the raw file over HTTP with range-request support. This already gives us the biggest advantage over file-browser access — efficient HTTP delivery. It works well for images and for MP4 files that are already H.264/AAC with a front-loaded moov atom. But for non-MP4 containers, files with the moov atom at the end, or incompatible codecs, playback either stalls or fails entirely.

---

## The Plan

Broken into phases so each one delivers standalone value. Each phase builds on the previous.

### Phase 1: Video Metadata & Codec Detection

**Goal:** Know what we're working with before deciding how to serve it.

- Run `ffprobe` (bundled with ffmpeg, already in our Docker image) during library scan to extract:
  - **Container format** (mp4, mkv, avi, webm, mov)
  - **Video codec** (h264, hevc, vp9, av1, etc.)
  - **Audio codec** (aac, opus, mp3, flac, ac3, etc.)
  - **Resolution** (width × height)
  - **Duration** (seconds)
  - **Bitrate** (total and per-stream)
- Add columns to the `media` table: `duration`, `width`, `height`, `video_codec`, `audio_codec`, `container_format`, `bitrate`
- Populate on scan; backfill existing entries via a one-time migration task
- Display this metadata in the info panel (duration, resolution, codec)

**Why first:** Every subsequent phase needs this data to make decisions. Zero impact on playback — purely additive.

### Phase 2: Direct Stream & Container Remuxing

**Goal:** Make all browser-compatible codecs stream instantly, regardless of their container or MP4 structure.

This phase handles two related problems with near-zero CPU cost and zero quality loss:

**Remuxing non-MP4 containers:** Many files on a NAS are H.264/AAC video inside `.mkv` containers. The codec is already browser-compatible — only the container is wrong. Remuxing to MP4 is a copy operation that uses negligible CPU.

**Fast-start for existing MP4s:** MP4 files with the moov atom at the end can't start playback until the player has fetched that metadata. Piping through ffmpeg as fragmented MP4 eliminates this problem entirely.

- At serve time, check the media's codec/container metadata from Phase 1
- If video is **H.264/AAC but not in MP4** (e.g., `.mkv`, `.avi`), remux on-the-fly:
  `ffmpeg -i input.mkv -c copy -movflags frag_keyframe+empty_moov -f mp4 pipe:1`
  - `-c copy` = no re-encoding, just repackaging
  - `-movflags frag_keyframe+empty_moov` = fragmented MP4 that streams immediately
  - Pipe directly to the HTTP response as a stream
- If video is **already H.264/AAC in a well-formed MP4** (moov atom at the front), serve directly (current behavior — the fast path)
- If video is **H.264/AAC in MP4 but with a trailing moov atom**, pipe through ffmpeg with `-c copy -movflags frag_keyframe+empty_moov` to fix the structure on-the-fly
- If video codec is **not browser-compatible**, fall back to raw serving for now (Phase 3 handles this)

**Why second:** This is the highest-impact phase. It covers the vast majority of video files (H.264 is dominant) with negligible server load. Combined with the HTTP streaming we already have, this gets us to parity with Plex's "direct play" behavior for most content.

### Phase 3: On-the-Fly Transcoding

**Goal:** Handle the remaining files — those with codecs the browser can't play natively (HEVC, VP9 in non-WebM, etc.) — and optionally allow lower-quality streaming on slow connections.

After Phase 2, most files will already stream fine via direct play or remux. This phase covers the rest.

- Build a transcoding pipeline that converts to H.264/AAC fragmented MP4 on-the-fly via ffmpeg
- Use `-movflags frag_keyframe+empty_moov` for immediate streaming (same as Phase 2's remux, but with actual re-encoding)
- Support quality presets based on the source metadata from Phase 1:
  - **Original** — direct stream or remux (Phases 1–2)
  - **High** — 1080p, ~8 Mbps
  - **Medium** — 720p, ~4 Mbps
  - **Low** — 480p, ~1.5 Mbps
- Add a query parameter to the file endpoint: `/api/media/[id]/file?quality=medium`
- Implement a simple transcoding queue to prevent the Synology from being overwhelmed (limit concurrent transcodes, likely to 1 given NAS hardware)
- Cache transcoded output to the metadata directory to avoid re-transcoding on repeat views

**Why third:** This is CPU-heavy and only needed for files that can't be remuxed. For most libraries it's a small percentage of content, but it's the difference between those files being unplayable and working. Quality presets are a bonus for genuinely slow connections.

### Phase 4: HLS Segmented Streaming

**Goal:** Improve the transcoding experience with segmented delivery and adaptive bitrate switching.

For direct play and remuxed content (Phases 1–2), plain HTTP with range requests works great — there's no need for HLS. But for transcoded content (Phase 3), HLS adds real value:

- Generate HLS playlists (`.m3u8`) and segments (`.ts` or fragmented `.mp4`) via ffmpeg
- New endpoint: `/api/media/[id]/stream/master.m3u8` — returns the master playlist
- New endpoint: `/api/media/[id]/stream/[quality]/segment-[n].ts` — returns individual segments
- Segments generated on-demand and cached in the metadata directory
- Swap the frontend `<video>` tag to use **hls.js** (lightweight HLS player library for browsers; Safari supports HLS natively)
- Master playlist can list multiple quality variants, enabling the player to auto-switch based on bandwidth

**Why last:** Only matters for transcoded content, which is already the minority of files after Phase 2. The fragmented MP4 approach in Phases 2–3 already provides excellent streaming behavior. HLS adds polish — adaptive quality switching and slightly faster seeking in transcoded streams — but isn't essential.

---

## What We're NOT Doing

Keeping scope realistic for a personal media server on a Synology NAS:

- **GPU-accelerated transcoding** — Most Synology models don't have usable GPU transcoding. If yours does (Intel Quick Sync), this could be added later as an ffmpeg flag.
- **Pre-transcoding entire libraries** — Too much disk space and processing time. On-demand + caching is the right tradeoff.
- **DASH support** — HLS has won. Every browser supports it (natively or via hls.js). No need for both.
- **Subtitle extraction/conversion** — Nice to have, but not part of the core streaming problem.
- **Live TV / DVR** — Out of scope entirely.

---

## Summary

| Phase | Effort | Impact | Depends On |
|---|---|---|---|
| 1. Video Metadata | Small | Foundational (enables everything else) | Nothing |
| 2. Direct Stream / Remux | Medium | **Highest** (most files stream perfectly) | Phase 1 |
| 3. On-the-Fly Transcoding | Large | Medium (covers incompatible codecs) | Phase 1 |
| 4. HLS Streaming | Large | Low (polish for transcoded content) | Phases 1–3 |

Phases 1 and 2 together will get us to parity with Plex's direct play behavior for the vast majority of files, with relatively modest effort. We already have the biggest advantage — HTTP streaming — so the remaining work is about making every container and codec play correctly in the browser. Phase 3 fills in the gaps for exotic codecs. Phase 4 is optional polish.
