import { describe, it, expect, vi, beforeEach } from 'vitest';
import { probeMediaFile } from './probe';
import type { ProbeResult } from './probe';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// Mock child_process.spawn
vi.mock('child_process', () => ({
	spawn: vi.fn()
}));

// Mock the logger so tests don't produce console output
vi.mock('$lib/server/logging', () => ({
	getLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn()
	})
}));

import { spawn } from 'child_process';

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

function createMockProcess(): ChildProcess {
	const proc = new EventEmitter() as ChildProcess;
	proc.stdout = new EventEmitter() as Readable;
	proc.stderr = new EventEmitter() as Readable;
	return proc;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('probeMediaFile', () => {
	it('parses a typical H.264/AAC MP4 file', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/test/video.mp4');

		const ffprobeOutput = {
			streams: [
				{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 },
				{ codec_type: 'audio', codec_name: 'aac' }
			],
			format: {
				format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
				duration: '7200.5',
				bit_rate: '4500000'
			}
		};

		proc.stdout!.emit('data', Buffer.from(JSON.stringify(ffprobeOutput)));
		proc.emit('close', 0);

		const result = await promise;

		expect(result).toEqual<ProbeResult>({
			duration: 7200.5,
			width: 1920,
			height: 1080,
			video_codec: 'h264',
			audio_codec: 'aac',
			container_format: 'mov',
			bitrate: 4500000
		});
	});

	it('parses an MKV file with HEVC/FLAC', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/test/video.mkv');

		const ffprobeOutput = {
			streams: [
				{ codec_type: 'video', codec_name: 'hevc', width: 3840, height: 2160 },
				{ codec_type: 'audio', codec_name: 'flac' }
			],
			format: {
				format_name: 'matroska,webm',
				duration: '120.0',
				bit_rate: '25000000'
			}
		};

		proc.stdout!.emit('data', Buffer.from(JSON.stringify(ffprobeOutput)));
		proc.emit('close', 0);

		const result = await promise;

		expect(result).toEqual<ProbeResult>({
			duration: 120.0,
			width: 3840,
			height: 2160,
			video_codec: 'hevc',
			audio_codec: 'flac',
			container_format: 'matroska',
			bitrate: 25000000
		});
	});

	it('handles video-only files (no audio stream)', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/test/silent.mp4');

		const ffprobeOutput = {
			streams: [
				{ codec_type: 'video', codec_name: 'h264', width: 640, height: 480 }
			],
			format: {
				format_name: 'mp4',
				duration: '10.0',
				bit_rate: '1000000'
			}
		};

		proc.stdout!.emit('data', Buffer.from(JSON.stringify(ffprobeOutput)));
		proc.emit('close', 0);

		const result = await promise;

		expect(result.audio_codec).toBeNull();
		expect(result.video_codec).toBe('h264');
	});

	it('handles files with missing format fields', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/test/weird.avi');

		const ffprobeOutput = {
			streams: [
				{ codec_type: 'video', codec_name: 'mpeg4', width: 320, height: 240 }
			],
			format: {
				format_name: 'avi'
			}
		};

		proc.stdout!.emit('data', Buffer.from(JSON.stringify(ffprobeOutput)));
		proc.emit('close', 0);

		const result = await promise;

		expect(result.duration).toBeNull();
		expect(result.bitrate).toBeNull();
		expect(result.container_format).toBe('avi');
		expect(result.video_codec).toBe('mpeg4');
	});

	it('returns all nulls when ffprobe exits with non-zero code', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/test/corrupt.mp4');

		proc.stderr!.emit('data', Buffer.from('Error reading file'));
		proc.emit('close', 1);

		const result = await promise;

		expect(result).toEqual<ProbeResult>({
			duration: null,
			width: null,
			height: null,
			video_codec: null,
			audio_codec: null,
			container_format: null,
			bitrate: null
		});
	});

	it('returns all nulls when ffprobe emits an error (e.g. not installed)', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/test/video.mp4');

		proc.emit('error', new Error('spawn ffprobe ENOENT'));

		const result = await promise;

		expect(result).toEqual<ProbeResult>({
			duration: null,
			width: null,
			height: null,
			video_codec: null,
			audio_codec: null,
			container_format: null,
			bitrate: null
		});
	});

	it('returns all nulls when ffprobe outputs invalid JSON', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/test/video.mp4');

		proc.stdout!.emit('data', Buffer.from('not valid json'));
		proc.emit('close', 0);

		const result = await promise;

		expect(result).toEqual<ProbeResult>({
			duration: null,
			width: null,
			height: null,
			video_codec: null,
			audio_codec: null,
			container_format: null,
			bitrate: null
		});
	});

	it('passes correct arguments to ffprobe', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/media/movies/test.mkv');

		proc.stdout!.emit('data', Buffer.from('{}'));
		proc.emit('close', 0);

		await promise;

		expect(mockSpawn).toHaveBeenCalledWith(
			'ffprobe',
			[
				'-v', 'quiet',
				'-print_format', 'json',
				'-show_format',
				'-show_streams',
				'/media/movies/test.mkv'
			],
			{ timeout: 15000 }
		);
	});

	it('handles chunked stdout data', async () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const promise = probeMediaFile('/test/video.mp4');

		const fullOutput = JSON.stringify({
			streams: [{ codec_type: 'video', codec_name: 'h264', width: 1280, height: 720 }],
			format: { format_name: 'mp4', duration: '60.0', bit_rate: '2000000' }
		});

		// Simulate chunked output
		const mid = Math.floor(fullOutput.length / 2);
		proc.stdout!.emit('data', Buffer.from(fullOutput.slice(0, mid)));
		proc.stdout!.emit('data', Buffer.from(fullOutput.slice(mid)));
		proc.emit('close', 0);

		const result = await promise;

		expect(result.video_codec).toBe('h264');
		expect(result.width).toBe(1280);
		expect(result.height).toBe(720);
		expect(result.duration).toBe(60.0);
	});
});
