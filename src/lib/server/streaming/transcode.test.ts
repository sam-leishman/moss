import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import type { ChildProcess } from 'child_process';

// Mock modules
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
	getMetadataDir: () => '/test-metadata'
}));

vi.mock('fs', async () => {
	const actual = await vi.importActual<typeof import('fs')>('fs');
	return {
		...actual,
		existsSync: vi.fn(() => false),
		mkdirSync: vi.fn(),
		createReadStream: vi.fn(() => new Readable({ read() {} })),
		createWriteStream: vi.fn(() => ({
			write: vi.fn(),
			end: vi.fn()
		})),
		unlinkSync: vi.fn()
	};
});

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import {
	getAvailableQualities,
	getTranscodeProfile,
	getTranscodeCachePath,
	hasTranscodeCache,
	createTranscodeStream,
	canStartTranscode,
	getActiveTranscodeCount,
	resetTranscodeQueue
} from './transcode';

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

function createMockProcess(): ChildProcess {
	const proc = new EventEmitter() as ChildProcess;
	const stdout = new Readable({ read() {} });
	(proc as any).stdout = stdout;
	(proc as any).stderr = new EventEmitter();
	return proc;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockExistsSync.mockReturnValue(false);
	resetTranscodeQueue();
});

describe('getAvailableQualities', () => {
	it('returns only original when no dimensions', () => {
		expect(getAvailableQualities(null, null)).toEqual(['original']);
		expect(getAvailableQualities(1920, null)).toEqual(['original']);
		expect(getAvailableQualities(null, 1080)).toEqual(['original']);
	});

	it('returns all qualities for 4K source', () => {
		const qualities = getAvailableQualities(3840, 2160);
		expect(qualities).toContain('original');
		expect(qualities).toContain('high');
		expect(qualities).toContain('medium');
		expect(qualities).toContain('low');
	});

	it('returns medium and low for exact 1080p source', () => {
		const qualities = getAvailableQualities(1920, 1080);
		expect(qualities).toContain('original');
		expect(qualities).not.toContain('high');
		expect(qualities).toContain('medium');
		expect(qualities).toContain('low');
	});

	it('returns only low for exact 720p source', () => {
		const qualities = getAvailableQualities(1280, 720);
		expect(qualities).toContain('original');
		expect(qualities).not.toContain('high');
		expect(qualities).not.toContain('medium');
		expect(qualities).toContain('low');
	});

	it('returns only original for exact 480p source', () => {
		const qualities = getAvailableQualities(854, 480);
		expect(qualities).toEqual(['original']);
	});

	it('returns only original for very small source', () => {
		const qualities = getAvailableQualities(640, 360);
		expect(qualities).toEqual(['original']);
	});

	it('uses shorter dimension for portrait videos', () => {
		// 480x854 portrait video — short side is 480, same as 480p preset, no downscale available
		const qualities = getAvailableQualities(480, 854);
		expect(qualities).toEqual(['original']);
	});
});

describe('getTranscodeProfile', () => {
	it('returns null for original quality', () => {
		expect(getTranscodeProfile('original')).toBeNull();
	});

	it('returns correct profile for high quality', () => {
		const profile = getTranscodeProfile('high');
		expect(profile).not.toBeNull();
		expect(profile!.maxHeight).toBe(1080);
		expect(profile!.label).toBe('1080p');
	});

	it('returns correct profile for medium quality', () => {
		const profile = getTranscodeProfile('medium');
		expect(profile).not.toBeNull();
		expect(profile!.maxHeight).toBe(720);
		expect(profile!.label).toBe('720p');
	});

	it('returns correct profile for low quality', () => {
		const profile = getTranscodeProfile('low');
		expect(profile).not.toBeNull();
		expect(profile!.maxHeight).toBe(480);
		expect(profile!.label).toBe('480p');
	});
});

describe('getTranscodeCachePath', () => {
	it('returns path in metadata dir with media ID and quality', () => {
		const path = getTranscodeCachePath(42, 'medium');
		expect(path).toBe('/test-metadata/transcode-cache/42-medium.mp4');
	});

	it('returns different paths for different qualities', () => {
		const high = getTranscodeCachePath(1, 'high');
		const low = getTranscodeCachePath(1, 'low');
		expect(high).not.toBe(low);
	});
});

describe('hasTranscodeCache', () => {
	it('returns false when cache file does not exist', () => {
		mockExistsSync.mockReturnValue(false);
		expect(hasTranscodeCache(1, 'high')).toBe(false);
	});

	it('returns true when cache file exists', () => {
		mockExistsSync.mockReturnValue(true);
		expect(hasTranscodeCache(1, 'high')).toBe(true);
	});
});

describe('createTranscodeStream', () => {
	it('returns null for original quality', () => {
		expect(createTranscodeStream('/test.mkv', 1, 'original')).toBeNull();
	});

	it('spawns ffmpeg with correct encoding arguments', () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		createTranscodeStream('/test/video.mkv', 1, 'medium');

		expect(mockSpawn).toHaveBeenCalledWith(
			'ffmpeg',
			expect.arrayContaining([
				'-i', '/test/video.mkv',
				'-c:v', 'libx264',
				'-preset', 'fast',
				'-b:v', '4M',
				'-c:a', 'aac',
				'-b:a', '128k',
				'-ac', '2',
				'-movflags', 'frag_keyframe+empty_moov+default_base_moof',
				'-f', 'mp4',
				'pipe:1'
			]),
			{ stdio: ['ignore', 'pipe', 'pipe'] }
		);
	});

	it('returns the stdout stream', () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		const result = createTranscodeStream('/test/video.mkv', 1, 'high');

		expect(result).not.toBeNull();
		expect(result!.stream).toBe(proc.stdout);
		expect(result!.process).toBe(proc);
	});

	it('includes scale filter for the target resolution', () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		createTranscodeStream('/test/video.mkv', 1, 'low');

		const args = mockSpawn.mock.calls[0][1] as string[];
		const vfIndex = args.indexOf('-vf');
		expect(vfIndex).toBeGreaterThan(-1);
		expect(args[vfIndex + 1]).toContain('480');
	});
});

describe('transcode queue', () => {
	it('starts with zero active transcodes', () => {
		expect(canStartTranscode()).toBe(true);
	});

	it('returns null when queue is full', () => {
		// Start one transcode to fill the queue
		const proc1 = createMockProcess();
		mockSpawn.mockReturnValue(proc1);
		createTranscodeStream('/test/video1.mkv', 1, 'high');

		// Second transcode should be rejected
		const result = createTranscodeStream('/test/video2.mkv', 2, 'high');
		expect(result).toBeNull();
	});

	it('frees queue slot when transcode completes', () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);
		createTranscodeStream('/test/video.mkv', 1, 'high');

		expect(canStartTranscode()).toBe(false);

		// Simulate ffmpeg completing
		proc.emit('close', 0);

		expect(canStartTranscode()).toBe(true);
	});

	it('frees queue slot when transcode fails', () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);
		createTranscodeStream('/test/video.mkv', 1, 'high');

		expect(canStartTranscode()).toBe(false);

		// Simulate ffmpeg error
		proc.emit('close', 1);

		expect(canStartTranscode()).toBe(true);
	});

	it('frees queue slot on spawn error', () => {
		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);
		createTranscodeStream('/test/video.mkv', 1, 'high');

		expect(canStartTranscode()).toBe(false);

		// Add a listener to prevent unhandled error from throwing
		proc.on('error', () => {});
		proc.emit('error', new Error('spawn failed'));

		expect(canStartTranscode()).toBe(true);
	});
});
