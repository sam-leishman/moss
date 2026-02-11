import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getStreamDecision,
	createRemuxStream,
	hasRemuxCache,
	isRemuxing,
	startRemuxToCache,
	getRemuxCachePath,
	invalidateRemuxCache,
	resetRemuxJobs
} from './remux';
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

vi.mock('$lib/server/config', () => ({
	getMetadataDir: () => '/tmp/test-metadata'
}));

vi.mock('fs', async () => {
	const actual = await vi.importActual<typeof import('fs')>('fs');
	return {
		...actual,
		existsSync: vi.fn().mockReturnValue(false),
		mkdirSync: vi.fn(),
		statSync: vi.fn().mockReturnValue({ size: 1024 }),
		unlinkSync: vi.fn()
	};
});

import { spawn } from 'child_process';
import { existsSync, statSync, unlinkSync } from 'fs';

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;
const mockStatSync = statSync as unknown as ReturnType<typeof vi.fn>;
const mockUnlinkSync = unlinkSync as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	resetRemuxJobs();
	mockExistsSync.mockReturnValue(false);
	mockStatSync.mockReturnValue({ size: 1024 });
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

		it('does not remux H.264/AAC in MP4 container (direct serve)', () => {
			const decision = getStreamDecision('h264', 'aac', 'mov');
			expect(decision.action).toBe('direct');
		});

		it('does not remux H.264/AAC in mp4 container (direct serve)', () => {
			const decision = getStreamDecision('h264', 'aac', 'mp4');
			expect(decision.action).toBe('direct');
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
		it('handles isom container as MP4-family (direct serve)', () => {
			const decision = getStreamDecision('h264', 'aac', 'isom');
			expect(decision.action).toBe('direct');
		});

		it('handles m4v container as MP4-family (direct serve)', () => {
			const decision = getStreamDecision('h264', 'aac', 'm4v');
			expect(decision.action).toBe('direct');
		});

		it('handles 3gp container as MP4-family (direct serve)', () => {
			const decision = getStreamDecision('h264', 'aac', '3gp');
			expect(decision.action).toBe('direct');
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

describe('remux cache', () => {
	function createMockProcess(): ChildProcess {
		const proc = new EventEmitter() as ChildProcess;
		(proc as any).stderr = new EventEmitter();
		(proc as any).killed = false;
		return proc;
	}

	describe('getRemuxCachePath', () => {
		it('returns path based on media ID', () => {
			const path = getRemuxCachePath(42);
			expect(path).toContain('remux-cache');
			expect(path).toContain('42.mp4');
		});
	});

	describe('hasRemuxCache', () => {
		it('returns false when cache file does not exist', () => {
			mockExistsSync.mockReturnValue(false);
			expect(hasRemuxCache(1)).toBe(false);
		});

		it('returns true when cache file exists with non-zero size and no active job', () => {
			mockExistsSync.mockReturnValue(true);
			mockStatSync.mockReturnValue({ size: 1024 });
			expect(hasRemuxCache(1)).toBe(true);
		});

		it('returns false when remux is in progress', () => {
			// Start remux first (existsSync returns false so it spawns)
			mockSpawn.mockReturnValue(createMockProcess());
			startRemuxToCache('/test/video.mkv', 1);
			// Now mock the file as existing — but job is still active
			mockExistsSync.mockReturnValue(true);
			mockStatSync.mockReturnValue({ size: 1024 });
			expect(hasRemuxCache(1)).toBe(false);
		});
	});

	describe('isRemuxing', () => {
		it('returns false when no remux is active', () => {
			expect(isRemuxing(1)).toBe(false);
		});

		it('returns true when remux is in progress', () => {
			mockSpawn.mockReturnValue(createMockProcess());
			startRemuxToCache('/test/video.mkv', 1);
			expect(isRemuxing(1)).toBe(true);
		});
	});

	describe('startRemuxToCache', () => {
		it('spawns ffmpeg with -c copy and +faststart', () => {
			mockSpawn.mockReturnValue(createMockProcess());
			startRemuxToCache('/test/video.mkv', 42);

			expect(mockSpawn).toHaveBeenCalledWith(
				'ffmpeg',
				expect.arrayContaining([
					'-i', '/test/video.mkv',
					'-c', 'copy',
					'-movflags', '+faststart',
					'-f', 'mp4'
				]),
				expect.any(Object)
			);
		});

		it('returns true if already cached', () => {
			mockExistsSync.mockReturnValue(true);
			mockStatSync.mockReturnValue({ size: 1024 });
			expect(startRemuxToCache('/test/video.mkv', 1)).toBe(true);
			expect(mockSpawn).not.toHaveBeenCalled();
		});

		it('returns true if already in progress', () => {
			mockSpawn.mockReturnValue(createMockProcess());
			startRemuxToCache('/test/video.mkv', 1);
			mockSpawn.mockClear();
			expect(startRemuxToCache('/test/video.mkv', 1)).toBe(true);
			expect(mockSpawn).not.toHaveBeenCalled();
		});

		it('clears active job on completion', () => {
			const proc = createMockProcess();
			mockSpawn.mockReturnValue(proc);
			startRemuxToCache('/test/video.mkv', 1);
			expect(isRemuxing(1)).toBe(true);

			proc.emit('close', 0);
			expect(isRemuxing(1)).toBe(false);
		});
	});

	describe('invalidateRemuxCache', () => {
		it('deletes cache file if it exists', () => {
			mockExistsSync.mockReturnValue(true);
			invalidateRemuxCache(1);
			expect(mockUnlinkSync).toHaveBeenCalled();
		});
	});
});
