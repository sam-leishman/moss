import { spawn } from 'child_process';
import { Readable } from 'stream';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('remux');

// Video codecs that browsers can play natively in an MP4 container
const BROWSER_COMPATIBLE_VIDEO_CODECS = new Set(['h264', 'vp9', 'av1']);

// Audio codecs that browsers can play natively in an MP4 container
const BROWSER_COMPATIBLE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'flac']);

// Container formats that are already MP4-family
const MP4_CONTAINERS = new Set(['mov', 'mp4', 'isom', 'm4a', 'm4v', '3gp']);

export interface StreamDecision {
	action: 'direct' | 'remux' | 'transcode';
	reason: string;
}

/**
 * Determines how to serve a video file based on its codec and container metadata.
 *
 * - direct: serve the raw file (no codec metadata available)
 * - remux: pipe through ffmpeg with -c copy to repackage into fragmented MP4
 * - transcode: re-encode to H.264/AAC fragmented MP4 (incompatible codec)
 */
export function getStreamDecision(
	videoCodec: string | null,
	audioCodec: string | null,
	containerFormat: string | null
): StreamDecision {
	// No codec info — can't make a decision, serve raw
	if (!videoCodec) {
		return { action: 'direct', reason: 'no codec metadata available' };
	}

	const videoCompatible = BROWSER_COMPATIBLE_VIDEO_CODECS.has(videoCodec);
	const audioCompatible = !audioCodec || BROWSER_COMPATIBLE_AUDIO_CODECS.has(audioCodec);

	if (!videoCompatible) {
		return { action: 'transcode', reason: `video codec "${videoCodec}" is not browser-compatible` };
	}

	if (!audioCompatible) {
		// Video is compatible but audio isn't — need to transcode the audio
		return { action: 'transcode', reason: `audio codec "${audioCodec}" is not browser-compatible` };
	}

	// Both codecs are compatible — check container
	const isMP4 = containerFormat ? MP4_CONTAINERS.has(containerFormat) : false;

	if (isMP4) {
		// Already MP4 with compatible codecs — serve directly with Range
		// support for full seeking. Browsers handle MP4 trailing moov atoms
		// well enough for playback with compatible codecs.
		return { action: 'direct', reason: 'MP4-family container with compatible codecs' };
	}

	// Compatible codecs but wrong container (e.g. MKV, AVI)
	return { action: 'remux', reason: `remuxing from "${containerFormat}" to fragmented MP4` };
}

/**
 * Spawns an ffmpeg process that remuxes the input file to fragmented MP4,
 * piping the output as a readable stream. Uses -c copy (no re-encoding).
 *
 * Returns both the readable stream and the ffmpeg ChildProcess so the caller
 * can manage the process lifecycle (e.g. kill on client disconnect).
 */
export function createRemuxStream(filePath: string): { stream: Readable; process: import('child_process').ChildProcess } {
	const ffmpeg = spawn(
		'ffmpeg',
		[
			'-i', filePath,
			'-c', 'copy',
			'-movflags', 'frag_keyframe+empty_moov+default_base_moof',
			'-f', 'mp4',
			'-v', 'error',
			'pipe:1'
		],
		{ stdio: ['ignore', 'pipe', 'pipe'] }
	);

	let stderr = '';

	ffmpeg.stderr.on('data', (data) => {
		stderr += data.toString();
	});

	ffmpeg.on('close', (code) => {
		if (code !== 0 && code !== null) {
			logger.warn(`ffmpeg remux exited with code ${code} for ${filePath}: ${stderr}`);
		}
	});

	ffmpeg.on('error', (err) => {
		logger.error(`ffmpeg remux failed for ${filePath}: ${err.message}`);
	});

	return { stream: ffmpeg.stdout, process: ffmpeg };
}
