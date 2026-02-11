# Progressive Transcode Streaming: Architecture Redesign

**Date:** February 10, 2026  
**Status:** Planning Phase  
**Priority:** Critical

---

## Executive Summary

This document outlines a plan to replace HLS-based on-demand transcoding with progressive transcode streaming for incompatible video codecs. The current HLS implementation has fundamental architectural issues that make reliable seeking impossible. Progressive streaming aligns with our existing remux architecture and provides a simpler, more reliable solution.

**Recommended Solution:** Extend the existing progressive streaming pattern (used for remux) to handle transcoding with Range request support for seeking.

---

## Backstory: Why We're Redesigning the Architecture

### The Original Problem
MKV videos with HEVC codec would stop playing mid-stream or when seeking. The video would buffer indefinitely without resuming playback.

### What We Tried (6 Failed Attempts)

#### 1. Custom hls.js Loader
**Theory:** Control which segments hls.js requests to maintain sequential generation.  
**Result:** Implementation errors and didn't solve the underlying issue.  
**Lesson:** Fighting against library behavior is a losing battle.

#### 2. Increased Buffer Settings
**Theory:** Larger buffers would prevent stalls.  
**Result:** No change - buffer size wasn't the problem.  
**Lesson:** Treating symptoms doesn't fix root causes.

#### 3. Disable Adaptive Bitrate
**Theory:** ABR was causing non-sequential segment requests.  
**Result:** Fixed initial playback, seeking still broke.  
**Lesson:** ABR wasn't the only source of non-sequential requests.

#### 4. Pre-generate Initial Segments
**Theory:** Ensure segments exist before playback starts.  
**Result:** Initial playback worked, seeking still broke.  
**Lesson:** Doesn't address seek-time behavior.

#### 5. EVENT Playlist Type
**Theory:** VOD playlists cause hls.js to probe end segments.  
**Result:** Video jumped to "live edge" immediately on load.  
**Lesson:** EVENT playlists signal live streams, causing wrong behavior.

#### 6. Ignore Far-Away Segment Requests
**Theory:** Keep playback job running, ignore probe requests.  
**Result:** Seeking broke completely - video never jumped to seek position.  
**Lesson:** Can't distinguish between real seeks and probes using distance alone.

### The Root Cause

Through extensive testing and logging, we identified the fundamental issue:

**When a user seeks in an HLS VOD playlist:**
1. hls.js requests the seek target segment (e.g., segment 173)
2. hls.js also probes end segments (e.g., segments 348, 352) to validate playlist
3. Server kills the FFmpeg job at segment 173 to handle segment 348
4. Segments 174-176 never get generated (needed for playback)
5. Video stops because required segments don't exist

**The Architectural Mismatch:**
- **HLS VOD design assumption:** All segments exist or can be fetched independently in any order
- **Our implementation:** Sequential on-demand generation with single FFmpeg job per stream
- **Result:** Non-sequential requests kill the active job, breaking playback

### Industry Research: Jellyfin

We researched how Jellyfin handles this. Key findings:

- **They use the exact same approach** (VOD playlist + on-demand segments with `-ss` seeking)
- **They have the same problems** (GitHub issues about seeking breaking playback, subtitle desync)
- **They haven't solved it** - users report issues, but Jellyfin accepts the limitations
- **They use `-noaccurate_seek`** which makes seeking faster but causes timestamp misalignment

**Conclusion:** Even mature media servers with large communities struggle with HLS + on-demand transcoding. This isn't a problem we can "fix" - it's an architectural incompatibility.

### Why Not Parallel FFmpeg Jobs?

The "proper" HLS solution would be running 2-3 concurrent FFmpeg jobs per stream (playback job + probe jobs). However:

- **Resource intensive:** Multiple FFmpeg transcodes per stream, multiplied by concurrent users
- **Complex implementation:** Job routing, priority management, lifecycle tracking
- **Doesn't scale:** 2 users watching 2 videos = 8-12 concurrent FFmpeg processes
- **Still fighting the protocol:** Adding complexity to work around HLS limitations

---

## The Solution: Progressive Transcode Streaming

### Why Progressive Streaming?

**We already use this pattern successfully for remux:**
- MKV with H.264/AAC → remux to MP4 with `-c copy` → stream progressively → seeking works perfectly
- Browser handles seeking via Range requests
- FFmpeg restarts at new position with `-ss`
- Simple, reliable, proven

**Extend the same pattern to transcoding:**
- MKV with HEVC → transcode to H.264/AAC → stream progressively → seeking works the same way
- No HLS complexity (no segments, playlists, hls.js)
- Same code patterns as existing remux implementation
- Browser-native seeking support

### How It Works

```
Initial Playback:
1. User clicks play
2. Server starts FFmpeg transcoding from position 0
3. FFmpeg outputs fragmented MP4 to stdout
4. Server streams data to browser as it's generated
5. Browser plays and buffers ahead automatically

Seeking:
1. User seeks to 17:36
2. Browser sends Range request for new position
3. Server kills current FFmpeg job
4. Server starts new FFmpeg job with -ss 17:36
5. Server streams from new position
6. Browser plays from seek position
```

### Architecture Alignment

This approach perfectly aligns with our existing streaming architecture:

**Current Architecture (from memory):**
1. **MP4 with compatible codecs:** Direct serve with Range support
2. **Non-MP4 with compatible codecs:** Remux to MP4, serve with Range support (cache for future)
3. **Incompatible codecs:** HLS transcode (current problem)

**New Architecture:**
1. **MP4 with compatible codecs:** Direct serve with Range support *(unchanged)*
2. **Non-MP4 with compatible codecs:** Remux to MP4, serve with Range support *(unchanged)*
3. **Incompatible codecs:** Progressive transcode with Range support *(new, consistent pattern)*

All three paths now use the same progressive streaming + Range request pattern.

---

## Implementation Plan

### Phase 1: Add Range Request Support to Transcode Stream (3-4 hours)

**Current state:** `createTranscodeStream()` in `transcode.ts` already creates fragmented MP4 output suitable for progressive streaming.

**What we need to add:**

1. **Add `-ss` parameter support** to `createTranscodeStream()`:
```typescript
export function createTranscodeStream(
  filePath: string,
  mediaId: number,
  quality: QualityPreset,
  startTime: number = 0  // NEW: seek position in seconds
): { stream: Readable; process: ChildProcess } | null
```

2. **Update FFmpeg arguments** to include seek:
```typescript
const ffmpeg = spawn('ffmpeg', [
  '-ss', startTime.toString(),  // NEW: seek to position
  '-i', filePath,
  '-c:v', 'libx264',
  '-preset', 'fast',
  // ... rest of existing args
]);
```

3. **Add accurate seek flag** for precise positioning:
```typescript
'-accurate_seek',  // Ensure precise timestamp alignment
```

**Files to modify:**
- `src/lib/server/streaming/transcode.ts` - Add `startTime` parameter and `-ss` argument

### Phase 2: Implement Range Request Handling (2-3 hours)

**Current state:** `serveTranscoded()` in `file/+server.ts` serves transcode stream without Range support.

**What we need to add:**

1. **Parse Range header** to get requested byte position
2. **Convert byte position to time position** using media duration and file size estimation
3. **Call `createTranscodeStream()` with calculated start time**
4. **Return 206 Partial Content response** with appropriate headers

**Implementation approach:**

```typescript
async function serveTranscoded(
  media: Media,
  quality: QualityPreset,
  request: Request
): Promise<Response> {
  // Check for Range request
  const range = request.headers.get('range');
  
  if (range && media.duration) {
    // Parse range: "bytes=1234567-"
    const start = parseInt(range.replace(/bytes=/, '').split('-')[0], 10);
    
    // Estimate time position based on bitrate
    // This is approximate but works well in practice
    const profile = getTranscodeProfile(quality);
    const estimatedBitrate = parseBitrate(profile.videoBitrate) + 
                            parseBitrate(profile.audioBitrate);
    const startTime = (start * 8) / estimatedBitrate;
    
    // Start transcode from seek position
    const result = createTranscodeStream(media.path, media.id, quality, startTime);
    
    return new Response(nodeStreamToWeb(result.stream, result.process), {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      }
    });
  }
  
  // No range request - serve from beginning (existing code)
  // ...
}
```

**Files to modify:**
- `src/routes/api/media/[id]/file/+server.ts` - Add Range request handling to `serveTranscoded()`
- `src/lib/server/streaming/transcode.ts` - Add helper function to parse bitrate strings

### Phase 3: Remove HLS for Transcoding (1-2 hours)

**Current state:** `getStreamDecision()` returns `'transcode'` which triggers HLS streaming.

**What we need to change:**

1. **Update `MediaDetailModal.svelte`** to use `/api/media/{id}/file?quality={quality}` for transcoded videos instead of HLS master playlist
2. **Remove HLS-specific code** from the video player component
3. **Use standard HTML5 `<video>` element** - browser handles everything

**Implementation:**

```svelte
{#if needsTranscode}
  <!-- Use progressive streaming endpoint, not HLS -->
  <video
    src="/api/media/{media.id}/file?quality={selectedQuality}"
    controls
    on:loadedmetadata={handleLoaded}
    on:error={handleError}
  />
{:else}
  <!-- Existing direct/remux playback -->
  <video src="/api/media/{media.id}/file" controls />
{/if}
```

**Files to modify:**
- `src/lib/components/MediaDetailModal.svelte` - Replace HLS player with standard video element for transcoded content
- `src/routes/api/media/[id]/qualities/+server.ts` - Update to indicate progressive streaming instead of HLS

### Phase 4: Testing and Validation (2 hours)

**Test scenarios:**

1. **Initial playback from start**
   - Expected: Video plays immediately, buffers ahead
   - Verify: No HLS requests, single FFmpeg process

2. **Seeking to middle of video**
   - Expected: Video seeks instantly, plays from new position
   - Verify: FFmpeg restarts with `-ss`, new stream begins

3. **Seeking backward**
   - Expected: Same as forward seeking
   - Verify: Old FFmpeg killed, new one starts

4. **Rapid seeking (scrubbing)**
   - Expected: FFmpeg jobs killed and restarted quickly
   - Verify: No resource leaks, old processes cleaned up

5. **Multiple quality levels**
   - Expected: Switching quality restarts transcode at current position
   - Verify: Correct quality profile applied

6. **Client disconnect**
   - Expected: FFmpeg process killed immediately
   - Verify: No orphaned processes

**Files to test:**
- All MKV files with HEVC codec
- Various video lengths (short, medium, long)
- Different resolutions (480p, 720p, 1080p)

### Phase 5: Cleanup (1 hour)

**Remove obsolete HLS code:**

1. **Keep HLS implementation** for potential future use (pre-encoded content, live streams)
2. **Remove HLS from transcode path** - no longer used for on-demand transcoding
3. **Update documentation** to reflect new architecture
4. **Update architecture memory** with progressive streaming approach

**Files to update:**
- Architecture memory - Document progressive streaming for all three paths
- Code comments - Clarify when HLS is/isn't used

---

## Implementation Estimate

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Add `-ss` support to transcode stream | 3-4 hours |
| 2 | Implement Range request handling | 2-3 hours |
| 3 | Remove HLS from transcode path | 1-2 hours |
| 4 | Testing and validation | 2 hours |
| 5 | Cleanup and documentation | 1 hour |
| **Total** | | **9-12 hours** |

---

## Success Criteria

### Must Have
- [ ] MKV with HEVC plays from start
- [ ] Seeking to any position works reliably
- [ ] Seeking backward works
- [ ] Rapid seeking (scrubbing) works without breaking
- [ ] Quality switching works
- [ ] Client disconnect kills FFmpeg process
- [ ] No HLS complexity in transcode path

### Should Have
- [ ] Seeking is instant (< 1 second to resume playback)
- [ ] No orphaned FFmpeg processes
- [ ] Resource usage is reasonable (1 FFmpeg per active stream)
- [ ] Works on all test MKV files

### Nice to Have
- [ ] Seek position estimation is accurate
- [ ] Smooth transition when seeking
- [ ] Progress bar shows buffered ranges

---

## Benefits Over HLS Approach

| Aspect | HLS (Current) | Progressive Streaming (New) |
|--------|---------------|----------------------------|
| **Complexity** | High (segments, playlists, hls.js) | Low (standard HTTP streaming) |
| **Seeking** | Broken (non-sequential requests) | Works (browser-native Range requests) |
| **Resource Usage** | 1 FFmpeg per stream | 1 FFmpeg per stream |
| **Code Maintenance** | Complex job management | Simple stream management |
| **Browser Support** | Requires hls.js library | Native HTML5 video |
| **Alignment** | Different from remux path | Same pattern as remux |
| **Scalability** | Limited by segment complexity | Standard HTTP streaming |
| **Debugging** | Complex (segments, jobs, probes) | Simple (FFmpeg + HTTP) |

---

## Risk Assessment

### Technical Risks

**Risk:** Byte-to-time conversion for Range requests is inaccurate  
**Impact:** Seeking lands at slightly wrong position  
**Mitigation:** Use conservative bitrate estimates, test with various files  
**Likelihood:** Low - estimation works well in practice

**Risk:** FFmpeg doesn't restart fast enough for smooth seeking  
**Impact:** Noticeable delay when seeking  
**Mitigation:** Use `-preset ultrafast` for lower latency, test on target hardware  
**Likelihood:** Low - `-ss` seeking is very fast

**Risk:** Fragmented MP4 output doesn't work with Range requests  
**Impact:** Browser can't seek properly  
**Mitigation:** Use correct `-movflags` (already in place), test thoroughly  
**Likelihood:** Very low - we already use this for remux successfully

### User Impact Risks

**Risk:** Regression in currently working remux playback  
**Impact:** Videos that worked before now broken  
**Mitigation:** Only modify transcode path, leave remux unchanged  
**Likelihood:** Very low - separate code paths

**Risk:** Performance worse than HLS  
**Impact:** Slower playback or seeking  
**Mitigation:** Progressive streaming is simpler and faster than HLS  
**Likelihood:** Very low - removing complexity improves performance

### Timeline Risks

**Risk:** Unforeseen issues with Range request implementation  
**Impact:** Implementation takes longer than estimated  
**Mitigation:** Phase-based approach, test each phase before continuing  
**Likelihood:** Medium - Range requests can be tricky

---

## Rollback Plan

If progressive streaming doesn't work:

1. **Immediate rollback:** Revert to HLS (broken seeking, but initial playback works)
2. **Alternative:** Pre-generate all segments (slow but reliable)
3. **Nuclear option:** Disable transcoding for HEVC (require compatible codecs only)

Keep current HLS code in place but unused, so rollback is trivial.

---

## Files to Modify

### Core Changes
- `src/lib/server/streaming/transcode.ts` - Add `-ss` parameter support
- `src/routes/api/media/[id]/file/+server.ts` - Add Range request handling

### Client Changes
- `src/lib/components/MediaDetailModal.svelte` - Use standard video element for transcoded content

### Minor Changes
- `src/routes/api/media/[id]/qualities/+server.ts` - Update quality metadata
- Architecture memory - Document new streaming approach

### No Changes Needed
- `src/lib/server/streaming/remux.ts` - Already works correctly
- `src/lib/server/streaming/hls.ts` - Keep for potential future use
- Direct serve path - Already works correctly

---

## Next Steps

1. **Review and approve this plan**
2. **Implement Phase 1** - Add `-ss` support to transcode stream
3. **Test Phase 1** - Verify FFmpeg starts at correct position
4. **Implement Phase 2** - Add Range request handling
5. **Test Phase 2** - Verify seeking works end-to-end
6. **Implement Phase 3** - Remove HLS from transcode path
7. **Test Phase 3** - Verify client uses progressive streaming
8. **Phase 4** - Comprehensive testing
9. **Phase 5** - Cleanup and documentation

---

## Conclusion

Progressive transcode streaming is the right solution for our use case:

- ✅ **Solves the root problem** - No more HLS architectural conflicts
- ✅ **Aligns with existing code** - Same pattern as remux
- ✅ **Simpler architecture** - Less code, fewer moving parts
- ✅ **Better user experience** - Reliable seeking that just works
- ✅ **Easier to maintain** - Standard HTTP streaming, no HLS complexity
- ✅ **Proven approach** - Browser-native Range requests are battle-tested

This isn't a band-aid fix - it's the correct architectural choice for a personal NAS media server with on-demand transcoding.
