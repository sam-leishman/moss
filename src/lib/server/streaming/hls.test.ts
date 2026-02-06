import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Mock modules
vi.mock('child_process', () => ({
	spawn: vi.fn(),
	execSync: vi.fn()
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
		readFileSync: vi.fn(),
		readdirSync: vi.fn(() => []),
		createReadStream: vi.fn(),
		createWriteStream: vi.fn(() => ({ write: vi.fn(), end: vi.fn() })),
		unlinkSync: vi.fn()
	};
});

// Must import after mocks
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import {
	generateMasterPlaylist,
	getHlsSegmentDir,
	hasHlsCache,
	isHlsGenerating,
	getHlsPlaylist,
	getHlsSegment,
	startHlsGeneration,
	resetHlsJobs
} from './hls';

// Also need to reset transcode queue since HLS uses canStartTranscode
import { resetTranscodeQueue } from './transcode';

const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	mockExistsSync.mockReturnValue(false);
	resetHlsJobs();
	resetTranscodeQueue();
});

describe('generateMasterPlaylist', () => {
	it('generates a valid master playlist with multiple qualities', () => {
		const playlist = generateMasterPlaylist(42, ['original', 'high', 'medium', 'low'], 1920, 1080);

		expect(playlist).toContain('#EXTM3U');
		expect(playlist).toContain('#EXT-X-VERSION:3');
		expect(playlist).toContain('#EXT-X-STREAM-INF:');
		expect(playlist).toContain('/api/media/42/stream/high/playlist.m3u8');
		expect(playlist).toContain('/api/media/42/stream/medium/playlist.m3u8');
		expect(playlist).toContain('/api/media/42/stream/low/playlist.m3u8');
	});

	it('excludes original quality from the playlist', () => {
		const playlist = generateMasterPlaylist(1, ['original', 'high'], 1920, 1080);

		expect(playlist).not.toContain('original');
		expect(playlist).toContain('high');
	});

	it('includes bandwidth and resolution in stream info', () => {
		const playlist = generateMasterPlaylist(1, ['original', 'high'], 1920, 1080);

		expect(playlist).toMatch(/BANDWIDTH=\d+/);
		expect(playlist).toMatch(/RESOLUTION=\d+x\d+/);
	});

	it('calculates correct aspect ratio for resolution', () => {
		const playlist = generateMasterPlaylist(1, ['original', 'medium'], 1920, 1080);

		// 720p at 16:9 should be 1280x720
		expect(playlist).toContain('1280x720');
	});

	it('uses 16:9 fallback when source dimensions are unknown', () => {
		const playlist = generateMasterPlaylist(1, ['original', 'low'], null, null);

		// 480p at 16:9 should be ~854x480
		expect(playlist).toMatch(/\d+x480/);
	});

	it('returns empty variants for only-original qualities', () => {
		const playlist = generateMasterPlaylist(1, ['original'], 1920, 1080);

		expect(playlist).toContain('#EXTM3U');
		expect(playlist).not.toContain('#EXT-X-STREAM-INF');
	});

	it('sorts variants by bandwidth descending', () => {
		const playlist = generateMasterPlaylist(1, ['original', 'high', 'medium', 'low'], 1920, 1080);

		const lines = playlist.split('\n');
		const bandwidths: number[] = [];
		for (const line of lines) {
			const match = line.match(/BANDWIDTH=(\d+)/);
			if (match) bandwidths.push(parseInt(match[1]));
		}

		expect(bandwidths.length).toBe(3);
		for (let i = 1; i < bandwidths.length; i++) {
			expect(bandwidths[i - 1]).toBeGreaterThanOrEqual(bandwidths[i]);
		}
	});
});

describe('getHlsSegmentDir', () => {
	it('returns path nested under media ID and quality', () => {
		const dir = getHlsSegmentDir(42, 'high');
		expect(dir).toBe('/test-metadata/hls-cache/42/high');
	});
});

describe('hasHlsCache', () => {
	it('returns false when playlist does not exist', () => {
		mockExistsSync.mockReturnValue(false);
		expect(hasHlsCache(1, 'high')).toBe(false);
	});

	it('returns false when playlist exists but is incomplete', () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:6.0,\nsegment-000.ts\n');
		expect(hasHlsCache(1, 'high')).toBe(false);
	});

	it('returns true when playlist exists and has ENDLIST', () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:6.0,\nsegment-000.ts\n#EXT-X-ENDLIST\n');
		expect(hasHlsCache(1, 'high')).toBe(true);
	});
});

describe('isHlsGenerating', () => {
	it('returns false when no job is active', () => {
		expect(isHlsGenerating(1, 'high')).toBe(false);
	});
});

describe('getHlsPlaylist', () => {
	it('returns null when playlist does not exist', () => {
		mockExistsSync.mockReturnValue(false);
		expect(getHlsPlaylist(1, 'high')).toBeNull();
	});

	it('returns playlist content when it exists', () => {
		mockExistsSync.mockReturnValue(true);
		const content = '#EXTM3U\n#EXT-X-VERSION:3\n';
		mockReadFileSync.mockReturnValue(content);
		expect(getHlsPlaylist(1, 'high')).toBe(content);
	});
});

describe('getHlsSegment', () => {
	it('returns null when segment does not exist', () => {
		mockExistsSync.mockReturnValue(false);
		expect(getHlsSegment(1, 'high', 'segment-000.ts')).toBeNull();
	});

	it('returns segment buffer when it exists', () => {
		mockExistsSync.mockReturnValue(true);
		const buf = Buffer.from('fake-segment-data');
		mockReadFileSync.mockReturnValue(buf);
		expect(getHlsSegment(1, 'high', 'segment-000.ts')).toBe(buf);
	});
});

describe('startHlsGeneration', () => {
	it('spawns ffmpeg with HLS arguments', () => {
		const proc = new EventEmitter() as ChildProcess;
		(proc as any).stderr = new EventEmitter();
		mockSpawn.mockReturnValue(proc);

		const started = startHlsGeneration('/test/video.mkv', 1, 'medium');

		expect(started).toBe(true);
		expect(mockSpawn).toHaveBeenCalledWith(
			'ffmpeg',
			expect.arrayContaining([
				'-i', '/test/video.mkv',
				'-c:v', 'libx264',
				'-c:a', 'aac',
				'-f', 'hls',
				'-hls_list_size', '0',
				'-hls_flags', 'independent_segments'
			]),
			expect.any(Object)
		);
	});

	it('includes correct bitrate and scale for the quality', () => {
		const proc = new EventEmitter() as ChildProcess;
		(proc as any).stderr = new EventEmitter();
		mockSpawn.mockReturnValue(proc);

		startHlsGeneration('/test/video.mkv', 1, 'low');

		const args = mockSpawn.mock.calls[0][1] as string[];
		expect(args).toContain('1500k');
		const vfIdx = args.indexOf('-vf');
		expect(vfIdx).toBeGreaterThan(-1);
		expect(args[vfIdx + 1]).toContain('480');
	});

	it('returns true if already generating', () => {
		const proc = new EventEmitter() as ChildProcess;
		(proc as any).stderr = new EventEmitter();
		mockSpawn.mockReturnValue(proc);

		startHlsGeneration('/test/video.mkv', 1, 'high');
		const result = startHlsGeneration('/test/video.mkv', 1, 'high');

		expect(result).toBe(true);
		// Should only spawn once
		expect(mockSpawn).toHaveBeenCalledTimes(1);
	});

	it('returns true if already fully cached', () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue('#EXTM3U\n#EXT-X-ENDLIST\n');

		const result = startHlsGeneration('/test/video.mkv', 1, 'high');
		expect(result).toBe(true);
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it('marks job as complete on successful close', () => {
		const proc = new EventEmitter() as ChildProcess;
		(proc as any).stderr = new EventEmitter();
		mockSpawn.mockReturnValue(proc);

		startHlsGeneration('/test/video.mkv', 1, 'high');
		expect(isHlsGenerating(1, 'high')).toBe(true);

		proc.emit('close', 0);
		expect(isHlsGenerating(1, 'high')).toBe(false);
	});

	it('marks job as error on non-zero exit', () => {
		const proc = new EventEmitter() as ChildProcess;
		(proc as any).stderr = new EventEmitter();
		mockSpawn.mockReturnValue(proc);

		startHlsGeneration('/test/video.mkv', 1, 'high');
		proc.emit('close', 1);

		expect(isHlsGenerating(1, 'high')).toBe(false);
	});
});
