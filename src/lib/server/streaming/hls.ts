import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { getMetadataDir } from '$lib/server/config';
import { getLogger } from '$lib/server/logging';
import type { QualityPreset } from './transcode';
import { getTranscodeProfile, reserveTranscodeSlot, releaseTranscodeSlot } from './transcode';

const logger = getLogger('hls');

const HLS_SEGMENT_DURATION = 6;

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
 * Returns the path to the variant playlist for a specific quality.
 */
export function getHlsPlaylistPath(mediaId: number, quality: QualityPreset): string {
	return join(getHlsSegmentDir(mediaId, quality), 'playlist.m3u8');
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
	// Clear any active job tracking for this media
	const qualities: QualityPreset[] = ['high', 'medium', 'low'];
	for (const quality of qualities) {
		activeHlsJobs.delete(getJobKey(mediaId, quality));
	}
}

// --- HLS Status Tracking ---

interface HlsJob {
	mediaId: number;
	quality: QualityPreset;
	status: 'generating' | 'complete' | 'error';
}

const activeHlsJobs = new Map<string, HlsJob>();

function getJobKey(mediaId: number, quality: QualityPreset): string {
	return `${mediaId}-${quality}`;
}

/**
 * Checks if HLS segments are fully generated and cached for a media/quality.
 */
export function hasHlsCache(mediaId: number, quality: QualityPreset): boolean {
	const playlistPath = getHlsPlaylistPath(mediaId, quality);
	if (!existsSync(playlistPath)) return false;

	// Check if the playlist contains the EXT-X-ENDLIST tag (fully generated)
	try {
		const content = readFileSync(playlistPath, 'utf-8');
		return content.includes('#EXT-X-ENDLIST');
	} catch {
		return false;
	}
}

/**
 * Checks if HLS generation is currently in progress for a media/quality.
 */
export function isHlsGenerating(mediaId: number, quality: QualityPreset): boolean {
	const key = getJobKey(mediaId, quality);
	const job = activeHlsJobs.get(key);
	return job?.status === 'generating';
}

/**
 * Returns the variant playlist content if it exists (even partially).
 */
export function getHlsPlaylist(mediaId: number, quality: QualityPreset): string | null {
	const playlistPath = getHlsPlaylistPath(mediaId, quality);
	if (!existsSync(playlistPath)) return null;

	try {
		return readFileSync(playlistPath, 'utf-8');
	} catch {
		return null;
	}
}

/**
 * Returns the segment file content if it exists.
 */
export function getHlsSegment(mediaId: number, quality: QualityPreset, segmentName: string): Buffer | null {
	const segmentPath = getHlsSegmentPath(mediaId, quality, segmentName);
	if (!existsSync(segmentPath)) return null;

	try {
		return readFileSync(segmentPath);
	} catch {
		return null;
	}
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

// --- HLS Segment Generation ---

/**
 * Starts generating HLS segments for a media file at a given quality.
 * Segments are written to the cache directory. The variant playlist is
 * updated as segments are generated, allowing progressive playback.
 *
 * Returns true if generation was started, false if it's already running
 * or the queue is full.
 */
export function startHlsGeneration(
	filePath: string,
	mediaId: number,
	quality: QualityPreset
): boolean {
	const key = getJobKey(mediaId, quality);

	// Already generating or complete
	if (activeHlsJobs.has(key)) {
		const status = activeHlsJobs.get(key)!.status;
		return status === 'generating' || status === 'complete';
	}

	// Already fully cached
	if (hasHlsCache(mediaId, quality)) {
		return true;
	}

	if (!reserveTranscodeSlot()) {
		return false;
	}

	const profile = getTranscodeProfile(quality);
	if (!profile) {
		releaseTranscodeSlot();
		return false;
	}

	const segmentDir = getHlsSegmentDir(mediaId, quality);
	const playlistPath = getHlsPlaylistPath(mediaId, quality);
	const segmentPattern = join(segmentDir, 'segment-%03d.ts');

	const scaleFilter = `scale=-2:'min(${profile.maxHeight},ih)'`;

	activeHlsJobs.set(key, { mediaId, quality, status: 'generating' });

	const ffmpeg = spawn(
		'ffmpeg',
		[
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
			'-hls_segment_filename', segmentPattern,
			'-hls_flags', 'independent_segments',
			'-v', 'error',
			'-y',
			playlistPath
		],
		{ stdio: ['ignore', 'ignore', 'pipe'] }
	);

	let stderr = '';
	let slotReleased = false;

	const releaseSlotOnce = () => {
		if (!slotReleased) {
			slotReleased = true;
			releaseTranscodeSlot();
		}
	};

	ffmpeg.stderr.on('data', (data: Buffer) => {
		stderr += data.toString();
	});

	ffmpeg.on('close', (code) => {
		releaseSlotOnce();
		if (code !== 0 && code !== null) {
			logger.warn(`HLS generation failed for media ${mediaId} (${quality}): ${stderr}`);
			activeHlsJobs.set(key, { mediaId, quality, status: 'error' });
		} else {
			logger.info(`HLS generation completed for media ${mediaId} at ${quality}`);
			activeHlsJobs.set(key, { mediaId, quality, status: 'complete' });
		}
	});

	ffmpeg.on('error', (err) => {
		releaseSlotOnce();
		logger.error(`HLS generation spawn error for media ${mediaId}: ${err.message}`);
		activeHlsJobs.set(key, { mediaId, quality, status: 'error' });
	});

	return true;
}

/**
 * Resets HLS job tracking state. For testing only.
 */
export function resetHlsJobs(): void {
	activeHlsJobs.clear();
}
