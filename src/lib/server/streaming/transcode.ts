import { spawn } from 'child_process';
import { Readable } from 'stream';
import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getMetadataDir } from '$lib/server/config';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('transcode');

export type QualityPreset = 'original' | 'high' | 'medium' | 'low';

export interface TranscodeProfile {
	label: string;
	maxHeight: number;
	videoBitrate: string;
	audioBitrate: string;
}

const TRANSCODE_PROFILES: Record<Exclude<QualityPreset, 'original'>, TranscodeProfile> = {
	high: {
		label: '1080p',
		maxHeight: 1080,
		videoBitrate: '8M',
		audioBitrate: '192k'
	},
	medium: {
		label: '720p',
		maxHeight: 720,
		videoBitrate: '4M',
		audioBitrate: '128k'
	},
	low: {
		label: '480p',
		maxHeight: 480,
		videoBitrate: '1500k',
		audioBitrate: '96k'
	}
};

/**
 * Returns the available quality presets for a given video based on its resolution.
 * Includes presets at or below the source resolution. Uses the shorter dimension
 * (min of width/height) so portrait videos don't offer upscale presets.
 * This ensures non-MP4 containers (e.g. MKV) always have at least one transcode
 * quality for HLS playback, since browsers can't play MKV natively.
 */
export function getAvailableQualities(sourceWidth: number | null, sourceHeight: number | null): QualityPreset[] {
	const qualities: QualityPreset[] = ['original'];

	if (!sourceWidth || !sourceHeight) return qualities;

	const shortSide = Math.min(sourceWidth, sourceHeight);

	for (const [key, profile] of Object.entries(TRANSCODE_PROFILES)) {
		if (shortSide >= profile.maxHeight) {
			qualities.push(key as QualityPreset);
		}
	}

	return qualities;
}

/**
 * Returns the transcode profile for a given quality preset, or null for 'original'.
 */
export function getTranscodeProfile(quality: QualityPreset): TranscodeProfile | null {
	if (quality === 'original') return null;
	return TRANSCODE_PROFILES[quality] ?? null;
}

// --- Transcode Cache ---

function getTranscodeCacheDir(): string {
	const dir = join(getMetadataDir(), 'transcode-cache');
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

/**
 * Returns the cache file path for a given media ID and quality preset.
 */
export function getTranscodeCachePath(mediaId: number, quality: QualityPreset): string {
	return join(getTranscodeCacheDir(), `${mediaId}-${quality}.mp4`);
}

/**
 * Checks if a cached transcode exists for the given media and quality.
 */
export function hasTranscodeCache(mediaId: number, quality: QualityPreset): boolean {
	return existsSync(getTranscodeCachePath(mediaId, quality));
}

/**
 * Returns a read stream for a cached transcode file.
 */
export function createCachedTranscodeStream(mediaId: number, quality: QualityPreset): Readable {
	return createReadStream(getTranscodeCachePath(mediaId, quality));
}

/**
 * Removes all cached transcode files for a given media ID.
 * Should be called when the source file changes on disk.
 */
export function invalidateTranscodeCache(mediaId: number): void {
	const qualities: Exclude<QualityPreset, 'original'>[] = ['high', 'medium', 'low'];
	for (const quality of qualities) {
		const cachePath = getTranscodeCachePath(mediaId, quality);
		if (existsSync(cachePath)) {
			try {
				unlinkSync(cachePath);
				logger.info(`Invalidated transcode cache for media ${mediaId} at ${quality}`);
			} catch { /* ignore */ }
		}
	}
}

// --- Transcode Queue ---

let activeTranscodes = 0;
const MAX_CONCURRENT_TRANSCODES = 1;

/**
 * Returns whether a new transcode can be started.
 */
export function canStartTranscode(): boolean {
	return activeTranscodes < MAX_CONCURRENT_TRANSCODES;
}

/**
 * Returns the current number of active transcodes.
 */
export function getActiveTranscodeCount(): number {
	return activeTranscodes;
}

/**
 * Reserves a transcode queue slot. Returns true if successful, false if full.
 */
export function reserveTranscodeSlot(): boolean {
	if (activeTranscodes >= MAX_CONCURRENT_TRANSCODES) return false;
	activeTranscodes++;
	return true;
}

/**
 * Releases a transcode queue slot.
 */
export function releaseTranscodeSlot(): void {
	activeTranscodes = Math.max(0, activeTranscodes - 1);
}

/**
 * Resets the transcode queue state. For testing only.
 */
export function resetTranscodeQueue(): void {
	activeTranscodes = 0;
}

// --- Transcode Stream ---

/**
 * Spawns an ffmpeg process that transcodes the input file to H.264/AAC fragmented MP4,
 * piping the output as a readable stream. Also writes to the cache file for future use.
 *
 * Returns null if the transcode queue is full. Returns both the readable stream
 * and the ffmpeg ChildProcess so the caller can manage the process lifecycle.
 */
export function createTranscodeStream(
	filePath: string,
	mediaId: number,
	quality: QualityPreset
): { stream: Readable; process: import('child_process').ChildProcess } | null {
	if (quality === 'original') {
		return null;
	}

	if (!reserveTranscodeSlot()) {
		return null;
	}

	const profile = getTranscodeProfile(quality);
	if (!profile) {
		releaseTranscodeSlot();
		return null;
	}

	const cachePath = getTranscodeCachePath(mediaId, quality);

	// Scale filter: scale to maxHeight, maintain aspect ratio, ensure even dimensions
	const scaleFilter = `scale=-2:'min(${profile.maxHeight},ih)'`;

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
			'-movflags', 'frag_keyframe+empty_moov+default_base_moof',
			'-f', 'mp4',
			'-v', 'error',
			'pipe:1'
		],
		{ stdio: ['ignore', 'pipe', 'pipe'] }
	);

	// Write stdout to cache file as it streams
	const cacheWrite = createWriteStream(cachePath);
	ffmpeg.stdout.on('data', (chunk: Buffer) => {
		cacheWrite.write(chunk);
	});
	ffmpeg.stdout.on('end', () => {
		cacheWrite.end();
	});

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
			logger.warn(`ffmpeg transcode exited with code ${code} for ${filePath} (${quality}): ${stderr}`);
			// Clean up partial cache file on failure
			try { unlinkSync(cachePath); } catch { /* ignore */ }
		} else {
			logger.info(`Transcode completed for media ${mediaId} at ${quality} quality`);
		}
	});

	ffmpeg.on('error', (err) => {
		releaseSlotOnce();
		logger.error(`ffmpeg transcode failed for ${filePath}: ${err.message}`);
	});

	return { stream: ffmpeg.stdout, process: ffmpeg };
}
