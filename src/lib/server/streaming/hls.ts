import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { getMetadataDir } from '$lib/server/config';
import { getLogger } from '$lib/server/logging';
import type { QualityPreset } from './transcode';
import { getTranscodeProfile } from './transcode';

const logger = getLogger('hls');

export const HLS_SEGMENT_DURATION = 6;

// --- HLS Cache Directories ---

function getHlsCacheDir(): string {
	const dir = join(getMetadataDir(), 'hls-cache');
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

/**
 * Returns the directory for HLS segments of a specific media/quality combination.
 */
export function getHlsSegmentDir(mediaId: number, quality: QualityPreset): string {
	const dir = join(getHlsCacheDir(), `${mediaId}`, quality);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

/**
 * Returns the path to a specific segment file.
 */
export function getHlsSegmentPath(mediaId: number, quality: QualityPreset, segmentName: string): string {
	return join(getHlsSegmentDir(mediaId, quality), segmentName);
}

/**
 * Removes all cached HLS segments and playlists for a given media ID.
 * Should be called when the source file changes on disk.
 */
export function invalidateHlsCache(mediaId: number): void {
	const mediaDir = join(getHlsCacheDir(), `${mediaId}`);
	if (existsSync(mediaDir)) {
		try {
			rmSync(mediaDir, { recursive: true, force: true });
			logger.info(`Invalidated HLS cache for media ${mediaId}`);
		} catch { /* ignore */ }
	}
	// Kill any active ffmpeg process for this media
	const qualities: QualityPreset[] = ['high', 'medium', 'low'];
	for (const quality of qualities) {
		killActiveJob(mediaId, quality);
	}
}

// --- HLS Job Tracking ---
// Tracks active ffmpeg processes for on-demand segment generation.
// Each media/quality pair has at most one active ffmpeg process,
// encoding sequentially from a given start segment.

interface HlsJob {
	process: ChildProcess;
	startSegment: number;
}

const activeHlsJobs = new Map<string, HlsJob>();

// Per-key mutex to serialize concurrent seek-restart decisions.
// Without this, hls.js requesting segments 100, 101, 102 concurrently
// can race: one kills the job and takes the transcode slot, while another
// sees no job and fails to reserve the (already taken) slot → 503.
const jobLocks = new Map<string, Promise<void>>();

function withJobLock<T>(key: string, fn: () => T): Promise<T> {
	const prev = jobLocks.get(key) ?? Promise.resolve();
	const next = prev.then(fn, fn);
	// Store the chain (void) so the next caller waits for us
	jobLocks.set(key, next.then(() => {}, () => {}));
	return next;
}

function getJobKey(mediaId: number, quality: QualityPreset): string {
	return `${mediaId}-${quality}`;
}

/**
 * Kills the active ffmpeg process for a media/quality pair, if any.
 */
function killActiveJob(mediaId: number, quality: QualityPreset): void {
	const key = getJobKey(mediaId, quality);
	const job = activeHlsJobs.get(key);
	if (job) {
		console.log(`[JOB KILL] Killing FFmpeg job for media ${mediaId} (${quality}) that was encoding from segment ${job.startSegment}`);
		if (!job.process.killed) {
			job.process.kill('SIGKILL');
		}
		activeHlsJobs.delete(key);
	}
}

/**
 * Checks if HLS generation is currently in progress for a media/quality.
 */
export function isHlsGenerating(mediaId: number, quality: QualityPreset): boolean {
	return activeHlsJobs.has(getJobKey(mediaId, quality));
}

/**
 * Returns the segment file content if it exists and is non-empty.
 */
export function getHlsSegment(mediaId: number, quality: QualityPreset, segmentName: string): Buffer | null {
	const segmentPath = getHlsSegmentPath(mediaId, quality, segmentName);
	if (!existsSync(segmentPath)) return null;

	try {
		const data = readFileSync(segmentPath);
		return data.length > 0 ? data : null;
	} catch {
		return null;
	}
}

/**
 * Checks if a specific segment exists on disk and is non-empty.
 */
export function hasSegment(mediaId: number, quality: QualityPreset, segmentIndex: number): boolean {
	const segmentName = `segment-${String(segmentIndex).padStart(3, '0')}.ts`;
	const segmentPath = getHlsSegmentPath(mediaId, quality, segmentName);
	if (!existsSync(segmentPath)) return false;
	try {
		return statSync(segmentPath).size > 0;
	} catch {
		return false;
	}
}

// --- VOD Playlist Generation ---
// The server generates a complete VOD playlist upfront using the known
// duration from the database. hls.js sees the full duration immediately,
// enabling seeking to any position. Segments are generated on-demand.

/**
 * Generates a complete VOD variant playlist for a specific quality level.
 * Lists all segments for the full video duration with #EXT-X-ENDLIST,
 * so hls.js treats it as a seekable VOD stream from the start.
 */
export function generateVodPlaylist(
	mediaId: number,
	quality: QualityPreset,
	durationSeconds: number
): string {
	const totalSegments = Math.ceil(durationSeconds / HLS_SEGMENT_DURATION);

	let playlist = '#EXTM3U\n';
	playlist += '#EXT-X-VERSION:3\n';
	playlist += '#EXT-X-PLAYLIST-TYPE:VOD\n';
	playlist += `#EXT-X-TARGETDURATION:${HLS_SEGMENT_DURATION}\n`;
	playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';

	for (let i = 0; i < totalSegments; i++) {
		const isLast = i === totalSegments - 1;
		const segmentDuration = isLast
			? durationSeconds - i * HLS_SEGMENT_DURATION
			: HLS_SEGMENT_DURATION;

		playlist += `#EXTINF:${segmentDuration.toFixed(6)},\n`;
		playlist += `/api/media/${mediaId}/stream/${quality}/segment-${String(i).padStart(3, '0')}.ts\n`;
	}

	playlist += '#EXT-X-ENDLIST\n';

	return playlist;
}

// --- Master Playlist Generation ---

interface QualityVariant {
	quality: QualityPreset;
	bandwidth: number;
	resolution: string;
	playlistUrl: string;
}

/**
 * Generates a master HLS playlist (m3u8) listing all available quality variants.
 */
export function generateMasterPlaylist(
	mediaId: number,
	qualities: QualityPreset[],
	sourceWidth: number | null,
	sourceHeight: number | null
): string {
	const variants: QualityVariant[] = [];

	for (const quality of qualities) {
		if (quality === 'original') continue;

		const profile = getTranscodeProfile(quality);
		if (!profile) continue;

		const bandwidth = parseBitrate(profile.videoBitrate) + parseBitrate(profile.audioBitrate);
		const height = profile.maxHeight;
		const width = sourceWidth && sourceHeight
			? Math.round((sourceWidth / sourceHeight) * height / 2) * 2
			: Math.round((16 / 9) * height / 2) * 2;

		variants.push({
			quality,
			bandwidth,
			resolution: `${width}x${height}`,
			playlistUrl: `/api/media/${mediaId}/stream/${quality}/playlist.m3u8`
		});
	}

	// Sort by bandwidth descending (highest quality first)
	variants.sort((a, b) => b.bandwidth - a.bandwidth);

	let playlist = '#EXTM3U\n';
	playlist += '#EXT-X-VERSION:3\n';

	for (const variant of variants) {
		playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.resolution},NAME="${variant.quality}"\n`;
		playlist += `${variant.playlistUrl}\n`;
	}

	return playlist;
}

/**
 * Parses a bitrate string like '8M', '4M', '1500k', '192k' into bits per second.
 */
function parseBitrate(bitrateStr: string): number {
	const match = bitrateStr.match(/^(\d+(?:\.\d+)?)\s*(M|k)?$/i);
	if (!match) return 0;

	const value = parseFloat(match[1]);
	const unit = match[2]?.toUpperCase();

	if (unit === 'M') return value * 1_000_000;
	if (unit === 'K') return value * 1_000;
	return value;
}

// --- On-Demand Segment Generation ---
// When hls.js requests a segment, the server checks if it exists on disk.
// If not, it kills any current ffmpeg for that media/quality and starts
// a new one from the requested segment's position using -ss (seek).
// This enables instant seeking — ffmpeg only encodes what's needed.

/**
 * Ensures a segment is available for serving. If the segment already exists
 * on disk, returns immediately. Otherwise, starts ffmpeg from the segment's
 * position and waits for it to be written.
 *
 * Returns true if the segment is ready, false if generation failed or timed out.
 */
export async function requestHlsSegment(
	filePath: string,
	mediaId: number,
	quality: QualityPreset,
	segmentIndex: number
): Promise<boolean> {
	// Already cached on disk
	if (hasSegment(mediaId, quality, segmentIndex)) {
		// Pre-buffer: find the next uncached segment and ensure encoding
		// is running from there, so the buffer doesn't run dry
		const nextUncached = findNextUncached(mediaId, quality, segmentIndex + 1);
		if (nextUncached !== null) {
			const key = getJobKey(mediaId, quality);
			withJobLock(key, () =>
				ensureEncodingFrom(filePath, mediaId, quality, nextUncached)
			).catch(() => {});
		}
		return true;
	}

	const key = getJobKey(mediaId, quality);

	// Serialize seek-restart decisions per media/quality to prevent races
	// when hls.js requests multiple segments concurrently
	const started = await withJobLock(key, () =>
		ensureEncodingFrom(filePath, mediaId, quality, segmentIndex)
	);

	// If ensureEncodingFrom failed (e.g. transcode queue full) but another
	// request already started a job for this media/quality, still wait —
	// that job will generate our segment eventually
	if (!started && !activeHlsJobs.has(key)) {
		return false;
	}

	// Wait for the segment to appear on disk
	return waitForSegment(mediaId, quality, segmentIndex);
}

/**
 * Finds the next uncached segment starting from a given index,
 * within a small lookahead window. Used for pre-buffering: when
 * serving a cached segment, we look ahead to ensure encoding is
 * running before the buffer runs dry.
 *
 * Returns null if all segments in the lookahead window are cached.
 */
function findNextUncached(
	mediaId: number,
	quality: QualityPreset,
	fromIndex: number,
	lookahead: number = 5
): number | null {
	for (let i = fromIndex; i < fromIndex + lookahead; i++) {
		if (!hasSegment(mediaId, quality, i)) {
			return i;
		}
	}
	return null;
}

/**
 * Finds the encoding frontier: the highest contiguous cached segment
 * starting from the job's start segment. This tells us where ffmpeg
 * has actually reached, not just where it started.
 */
function findEncodingFrontier(mediaId: number, quality: QualityPreset, startSegment: number): number {
	let frontier = startSegment;
	// Scan forward to find the last contiguous cached segment
	while (hasSegment(mediaId, quality, frontier)) {
		frontier++;
	}
	// frontier is now the first MISSING segment (i.e. what ffmpeg is working on next)
	return frontier;
}

/**
 * Ensures ffmpeg is encoding from the given segment index onwards.
 *
 * This function is only called when the segment does NOT exist on disk.
 * We check the actual encoding frontier (highest contiguous segment from
 * the job's start) to decide if the current job will reach the requested
 * segment soon, or if we need to kill and restart closer to the target.
 */
function ensureEncodingFrom(
	filePath: string,
	mediaId: number,
	quality: QualityPreset,
	segmentIndex: number
): boolean {
	const key = getJobKey(mediaId, quality);
	const existingJob = activeHlsJobs.get(key);

	if (existingJob) {
		// Find where ffmpeg has actually reached
		const frontier = findEncodingFrontier(mediaId, quality, existingJob.startSegment);

		// If the requested segment is at or just ahead of the frontier,
		// ffmpeg is about to produce it — let it continue
		if (segmentIndex >= frontier && segmentIndex - frontier <= 3) {
			return true;
		}

		// If the requested segment is far ahead (>50 segments), it's likely
		// a probe request from hls.js checking the end of the playlist.
		// Don't kill the current job - let it continue generating sequential
		// segments for playback. The probe request will timeout naturally.
		const distanceFromFrontier = segmentIndex - frontier;
		if (distanceFromFrontier > 50) {
			console.log(`[JOB KEEP] Ignoring far-away segment ${segmentIndex} request (frontier at ${frontier}, distance ${distanceFromFrontier}). Keeping job at segment ${existingJob.startSegment} running.`);
			return true; // Pretend we're handling it, but don't kill the job
		}

		// Segment is somewhat close but not immediately next - this is a real
		// seek to a nearby position. Kill and restart from the new position.
		killActiveJob(mediaId, quality);
	}

	return startEncodingFrom(filePath, mediaId, quality, segmentIndex);
}

/**
 * Starts ffmpeg encoding from a specific segment index.
 * Uses -ss to seek to the segment's start time, and -start_number to
 * name output segments correctly.
 */
function startEncodingFrom(
	filePath: string,
	mediaId: number,
	quality: QualityPreset,
	segmentIndex: number
): boolean {
	console.log(`[JOB START] Starting FFmpeg job for media ${mediaId} (${quality}) from segment ${segmentIndex}`);
	
	const profile = getTranscodeProfile(quality);
	if (!profile) {
		return false;
	}

	const segmentDir = getHlsSegmentDir(mediaId, quality);
	const segmentPattern = join(segmentDir, 'segment-%03d.ts');
	const seekTime = segmentIndex * HLS_SEGMENT_DURATION;
	const scaleFilter = `scale=-2:'min(${profile.maxHeight},ih)'`;

	// Use a throwaway playlist path — the server generates the real playlist.
	// ffmpeg requires a playlist output path for HLS muxer, but we don't use it.
	const throwawayPlaylist = join(segmentDir, '_ffmpeg_playlist.m3u8');

	const ffmpeg = spawn(
		'ffmpeg',
		[
			'-ss', seekTime.toString(),
			'-i', filePath,
			'-c:v', 'libx264',
			'-preset', 'fast',
			'-b:v', profile.videoBitrate,
			'-maxrate', profile.videoBitrate,
			'-vf', scaleFilter,
			'-c:a', 'aac',
			'-b:a', profile.audioBitrate,
			'-ac', '2',
			'-f', 'hls',
			'-hls_time', HLS_SEGMENT_DURATION.toString(),
			'-hls_list_size', '0',
			'-start_number', segmentIndex.toString(),
			'-hls_segment_filename', segmentPattern,
			'-hls_flags', 'independent_segments',
			'-v', 'error',
			'-y',
			throwawayPlaylist
		],
		{ stdio: ['ignore', 'ignore', 'pipe'] }
	);

	const key = getJobKey(mediaId, quality);
	const job: HlsJob = { process: ffmpeg, startSegment: segmentIndex };
	activeHlsJobs.set(key, job);

	let stderr = '';

	ffmpeg.stderr.on('data', (data: Buffer) => {
		stderr += data.toString();
	});

	ffmpeg.on('close', (code) => {
		// Only clean up if this is still the active job (not replaced by a seek)
		const currentJob = activeHlsJobs.get(key);
		if (currentJob === job) {
			activeHlsJobs.delete(key);
		}
		if (code !== 0 && code !== null) {
			logger.warn(`HLS encoding failed for media ${mediaId} (${quality}) from segment ${segmentIndex}: ${stderr}`);
		} else {
			logger.info(`HLS encoding completed for media ${mediaId} (${quality}) from segment ${segmentIndex}`);
		}
	});

	ffmpeg.on('error', (err) => {
		const currentJob = activeHlsJobs.get(key);
		if (currentJob === job) {
			activeHlsJobs.delete(key);
		}
		logger.error(`HLS encoding spawn error for media ${mediaId}: ${err.message}`);
	});

	return true;
}

/**
 * Waits for a segment to appear on disk, polling at short intervals.
 * Returns true if the segment becomes available, false on timeout.
 */
async function waitForSegment(
	mediaId: number,
	quality: QualityPreset,
	segmentIndex: number,
	timeoutMs: number = 30_000
): Promise<boolean> {
	const pollInterval = 250;
	const maxAttempts = Math.ceil(timeoutMs / pollInterval);

	for (let i = 0; i < maxAttempts; i++) {
		if (hasSegment(mediaId, quality, segmentIndex)) {
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, pollInterval));
	}

	logger.warn(`Timed out waiting for segment ${segmentIndex} of media ${mediaId} (${quality})`);
	return false;
}

/**
 * Pre-generates the first N segments for a media/quality combination.
 * This ensures smooth playback from the start and allows seeking to work
 * properly with VOD playlists.
 * 
 * Returns true if initial segments were successfully generated, false otherwise.
 */
export async function pregenerateInitialSegments(
	filePath: string,
	mediaId: number,
	quality: QualityPreset,
	count: number = 3
): Promise<boolean> {
	const key = getJobKey(mediaId, quality);
	
	// Check if we already have the initial segments
	let allCached = true;
	for (let i = 0; i < count; i++) {
		if (!hasSegment(mediaId, quality, i)) {
			allCached = false;
			break;
		}
	}
	
	if (allCached) {
		// Also ensure encoding continues in background for remaining segments
		const nextUncached = findNextUncached(mediaId, quality, count);
		if (nextUncached !== null) {
			withJobLock(key, () =>
				ensureEncodingFrom(filePath, mediaId, quality, nextUncached)
			).catch(() => {});
		}
		return true;
	}
	
	// Start encoding from segment 0
	const started = await withJobLock(key, () =>
		ensureEncodingFrom(filePath, mediaId, quality, 0)
	);
	
	if (!started) {
		return false;
	}
	
	// Wait for all initial segments to be generated
	for (let i = 0; i < count; i++) {
		const ready = await waitForSegment(mediaId, quality, i, 30_000);
		if (!ready) {
			return false;
		}
	}
	
	return true;
}

/**
 * Resets HLS job tracking state. For testing only.
 */
export function resetHlsJobs(): void {
	for (const [, job] of activeHlsJobs) {
		if (!job.process.killed) {
			job.process.kill('SIGKILL');
		}
	}
	activeHlsJobs.clear();
	jobLocks.clear();
}
