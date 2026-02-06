import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStreamDecision, createRemuxStream } from './remux';
import type { StreamDecision } from './remux';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import type { ChildProcess } from 'child_process';

// Mock child_process.spawn
vi.mock('child_process', () => ({
	spawn: vi.fn()
}));

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

beforeEach(() => {
	vi.clearAllMocks();
});

describe('getStreamDecision', () => {
	describe('remux cases', () => {
		it('remuxes H.264/AAC in MKV container', () => {
			const decision = getStreamDecision('h264', 'aac', 'matroska');
			expect(decision.action).toBe('remux');
		});

		it('remuxes H.264/AAC in AVI container', () => {
			const decision = getStreamDecision('h264', 'aac', 'avi');
			expect(decision.action).toBe('remux');
		});

		it('remuxes H.264/AAC in MP4 container (for fast-start guarantee)', () => {
			const decision = getStreamDecision('h264', 'aac', 'mov');
			expect(decision.action).toBe('remux');
		});

		it('remuxes H.264/AAC in mp4 container', () => {
			const decision = getStreamDecision('h264', 'aac', 'mp4');
			expect(decision.action).toBe('remux');
		});

		it('remuxes H.264/MP3 in MKV', () => {
			const decision = getStreamDecision('h264', 'mp3', 'matroska');
			expect(decision.action).toBe('remux');
		});

		it('remuxes H.264/Opus in WebM', () => {
			const decision = getStreamDecision('h264', 'opus', 'webm');
			expect(decision.action).toBe('remux');
		});

		it('remuxes H.264 with no audio', () => {
			const decision = getStreamDecision('h264', null, 'matroska');
			expect(decision.action).toBe('remux');
		});

		it('remuxes VP9/AAC in MKV', () => {
			const decision = getStreamDecision('vp9', 'aac', 'matroska');
			expect(decision.action).toBe('remux');
		});

		it('remuxes AV1/Opus in MKV', () => {
			const decision = getStreamDecision('av1', 'opus', 'matroska');
			expect(decision.action).toBe('remux');
		});

		it('remuxes H.264/FLAC in MKV', () => {
			const decision = getStreamDecision('h264', 'flac', 'matroska');
			expect(decision.action).toBe('remux');
		});
	});

	describe('transcode cases', () => {
		it('transcodes HEVC video', () => {
			const decision = getStreamDecision('hevc', 'aac', 'matroska');
			expect(decision.action).toBe('transcode');
			expect(decision.reason).toContain('hevc');
		});

		it('transcodes MPEG4 video', () => {
			const decision = getStreamDecision('mpeg4', 'aac', 'avi');
			expect(decision.action).toBe('transcode');
		});

		it('transcodes compatible video with incompatible audio (AC3)', () => {
			const decision = getStreamDecision('h264', 'ac3', 'matroska');
			expect(decision.action).toBe('transcode');
			expect(decision.reason).toContain('ac3');
		});

		it('transcodes compatible video with incompatible audio (DTS)', () => {
			const decision = getStreamDecision('h264', 'dts', 'mkv');
			expect(decision.action).toBe('transcode');
		});
	});

	describe('direct serve cases', () => {
		it('serves directly when no codec metadata is available', () => {
			const decision = getStreamDecision(null, null, null);
			expect(decision.action).toBe('direct');
		});

		it('serves directly when video codec is null', () => {
			const decision = getStreamDecision(null, 'aac', 'mp4');
			expect(decision.action).toBe('direct');
		});
	});

	describe('edge cases', () => {
		it('handles isom container as MP4-family', () => {
			const decision = getStreamDecision('h264', 'aac', 'isom');
			expect(decision.action).toBe('remux');
		});

		it('handles m4v container as MP4-family', () => {
			const decision = getStreamDecision('h264', 'aac', 'm4v');
			expect(decision.action).toBe('remux');
		});

		it('handles 3gp container as MP4-family', () => {
			const decision = getStreamDecision('h264', 'aac', '3gp');
			expect(decision.action).toBe('remux');
		});
	});
});

describe('createRemuxStream', () => {
	it('spawns ffmpeg with correct arguments', () => {
		const mockStdout = new Readable({ read() {} });
		const mockStderr = new EventEmitter();
		const proc = new EventEmitter() as ChildProcess;
		(proc as any).stdout = mockStdout;
		(proc as any).stderr = mockStderr;
		mockSpawn.mockReturnValue(proc);

		createRemuxStream('/test/video.mkv');

		expect(mockSpawn).toHaveBeenCalledWith(
			'ffmpeg',
			[
				'-i', '/test/video.mkv',
				'-c', 'copy',
				'-movflags', 'frag_keyframe+empty_moov+default_base_moof',
				'-f', 'mp4',
				'-v', 'error',
				'pipe:1'
			],
			{ stdio: ['ignore', 'pipe', 'pipe'] }
		);
	});

	it('returns the stdout stream from ffmpeg', () => {
		const mockStdout = new Readable({ read() {} });
		const mockStderr = new EventEmitter();
		const proc = new EventEmitter() as ChildProcess;
		(proc as any).stdout = mockStdout;
		(proc as any).stderr = mockStderr;
		mockSpawn.mockReturnValue(proc);

		const result = createRemuxStream('/test/video.mkv');

		expect(result.stream).toBe(mockStdout);
		expect(result.process).toBe(proc);
	});
});
