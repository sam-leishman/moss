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
		rmSync: vi.fn(),
		statSync: vi.fn(() => ({ size: 1024 })),
		unlinkSync: vi.fn()
	};
});

// Must import after mocks
import { existsSync, readFileSync, statSync } from 'fs';
import { spawn } from 'child_process';
import {
	generateMasterPlaylist,
	generateVodPlaylist,
	getHlsSegmentDir,
	isHlsGenerating,
	getHlsSegment,
	hasSegment,
	requestHlsSegment,
	resetHlsJobs,
	HLS_SEGMENT_DURATION
} from './hls';


const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockStatSync = statSync as ReturnType<typeof vi.fn>;
const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

function createMockProcess(): ChildProcess {
	const proc = new EventEmitter() as ChildProcess;
	(proc as any).stderr = new EventEmitter();
	(proc as any).killed = false;
	(proc as any).kill = vi.fn(() => { (proc as any).killed = true; });
	return proc;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockExistsSync.mockReturnValue(false);
	mockStatSync.mockReturnValue({ size: 1024 });
	resetHlsJobs();
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

describe('generateVodPlaylist', () => {
	it('generates a complete VOD playlist with correct segment count', () => {
		const playlist = generateVodPlaylist(1, 'high', 30);

		expect(playlist).toContain('#EXTM3U');
		expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
		expect(playlist).toContain(`#EXT-X-TARGETDURATION:${HLS_SEGMENT_DURATION}`);
		expect(playlist).toContain('#EXT-X-ENDLIST');

		// 30 seconds / 6 second segments = 5 segments
		const segmentLines = playlist.split('\n').filter((l: string) => l.includes('segment-'));
		expect(segmentLines.length).toBe(5);
	});

	it('includes correct segment URLs', () => {
		const playlist = generateVodPlaylist(42, 'medium', 12);

		expect(playlist).toContain('/api/media/42/stream/medium/segment-000.ts');
		expect(playlist).toContain('/api/media/42/stream/medium/segment-001.ts');
	});

	it('calculates correct last segment duration', () => {
		// 16 seconds / 6 = 2 full segments + 4 second remainder
		const playlist = generateVodPlaylist(1, 'high', 16);

		const extinfs = playlist.split('\n').filter((l: string) => l.startsWith('#EXTINF:'));
		expect(extinfs.length).toBe(3);
		// Last segment should be 4 seconds
		expect(extinfs[2]).toContain('4.000000');
	});

	it('handles exact segment boundary duration', () => {
		// 12 seconds / 6 = exactly 2 segments
		const playlist = generateVodPlaylist(1, 'high', 12);

		const segmentLines = playlist.split('\n').filter((l: string) => l.includes('segment-'));
		expect(segmentLines.length).toBe(2);
	});

	it('handles very short videos', () => {
		const playlist = generateVodPlaylist(1, 'low', 2);

		const segmentLines = playlist.split('\n').filter((l: string) => l.includes('segment-'));
		expect(segmentLines.length).toBe(1);
		expect(playlist).toContain('#EXTINF:2.000000');
	});
});

describe('getHlsSegmentDir', () => {
	it('returns path nested under media ID and quality', () => {
		const dir = getHlsSegmentDir(42, 'high');
		expect(dir).toBe('/test-metadata/hls-cache/42/high');
	});
});

describe('isHlsGenerating', () => {
	it('returns false when no job is active', () => {
		expect(isHlsGenerating(1, 'high')).toBe(false);
	});

	it('returns true when encoding is in progress', async () => {
		const pollCounts = new Map<string, number>();
		mockExistsSync.mockImplementation((path: string) => {
			if (!path.endsWith('.ts')) return false;
			const match = path.match(/segment-(\d{3})\.ts$/);
			if (!match) return false;
			const segNum = parseInt(match[1], 10);
			if (segNum === 0) {
				const key = `poll-${segNum}`;
				const count = (pollCounts.get(key) ?? 0) + 1;
				pollCounts.set(key, count);
				return count > 6;
			}
			return false;
		});
		mockStatSync.mockReturnValue({ size: 1024 });
		mockSpawn.mockReturnValue(createMockProcess());

		// Start encoding (don't await — we want to check mid-flight)
		const promise = requestHlsSegment('/test/video.mkv', 1, 'high', 0);
		// Let the microtask (withJobLock) resolve
		await new Promise((r) => setTimeout(r, 10));
		expect(isHlsGenerating(1, 'high')).toBe(true);
		await promise;
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

	it('returns null for empty segment file', () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(Buffer.alloc(0));
		expect(getHlsSegment(1, 'high', 'segment-000.ts')).toBeNull();
	});
});

describe('hasSegment', () => {
	it('returns false when segment does not exist', () => {
		mockExistsSync.mockReturnValue(false);
		expect(hasSegment(1, 'high', 0)).toBe(false);
	});

	it('returns true when segment exists with non-zero size', () => {
		mockExistsSync.mockReturnValue(true);
		mockStatSync.mockReturnValue({ size: 1024 });
		expect(hasSegment(1, 'high', 0)).toBe(true);
	});

	it('returns false for zero-size segment', () => {
		mockExistsSync.mockReturnValue(true);
		mockStatSync.mockReturnValue({ size: 0 });
		expect(hasSegment(1, 'high', 0)).toBe(false);
	});
});

describe('requestHlsSegment', () => {
	// Helper: create a path-aware mock for existsSync that handles
	// directory checks (always false to trigger mkdirSync) and
	// segment file checks based on a provided set of existing segments.
	function mockSegmentState(
		existingSegments: Set<number>,
		options?: { appearAfterPolls?: { segment: number; polls: number } }
	) {
		const pollCounts = new Map<string, number>();
		mockExistsSync.mockImplementation((path: string) => {
			if (!path.endsWith('.ts')) return false; // directory checks
			// Extract segment number from path
			const match = path.match(/segment-(\d{3})\.ts$/);
			if (!match) return false;
			const segNum = parseInt(match[1], 10);
			if (existingSegments.has(segNum)) return true;
			// Handle "appear after N polls" for waitForSegment
			if (options?.appearAfterPolls && segNum === options.appearAfterPolls.segment) {
				const key = `poll-${segNum}`;
				const count = (pollCounts.get(key) ?? 0) + 1;
				pollCounts.set(key, count);
				return count > options.appearAfterPolls.polls;
			}
			return false;
		});
		mockStatSync.mockReturnValue({ size: 1024 });
	}

	it('returns true immediately if segment already exists and all lookahead cached', async () => {
		// Segments 5-10 all cached — lookahead from 6 checks 6,7,8,9,10 → all exist, no pre-buffer
		mockSegmentState(new Set([5, 6, 7, 8, 9, 10]));

		const result = await requestHlsSegment('/test/video.mkv', 1, 'high', 5);
		expect(result).toBe(true);
		// Let any async pre-buffer attempt resolve
		await new Promise((r) => setTimeout(r, 10));
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it('pre-buffers from next uncached segment when serving a cached segment', async () => {
		// Segments 5-6 cached, 7 is not → pre-buffer should start encoding from 7
		mockSegmentState(new Set([5, 6]));
		mockSpawn.mockReturnValue(createMockProcess());

		const result = await requestHlsSegment('/test/video.mkv', 1, 'high', 5);
		expect(result).toBe(true);

		// Let the async pre-buffer withJobLock resolve
		await new Promise((r) => setTimeout(r, 10));
		expect(mockSpawn).toHaveBeenCalledTimes(1);
		const args = mockSpawn.mock.calls[0][1] as string[];
		// Should start encoding from segment 7 (7 * 6 = 42 seconds)
		expect(args[args.indexOf('-ss') + 1]).toBe('42');
		expect(args[args.indexOf('-start_number') + 1]).toBe('7');
	});

	it('spawns ffmpeg with -ss seek and -start_number when segment is missing', async () => {
		mockSegmentState(new Set(), { appearAfterPolls: { segment: 5, polls: 4 } });
		mockSpawn.mockReturnValue(createMockProcess());

		const result = await requestHlsSegment('/test/video.mkv', 1, 'medium', 5);

		expect(result).toBe(true);
		const args = mockSpawn.mock.calls[0][1] as string[];
		expect(args).toContain('-ss');
		expect(args[args.indexOf('-ss') + 1]).toBe('30');
		expect(args).toContain('-start_number');
		expect(args[args.indexOf('-start_number') + 1]).toBe('5');
	});

	it('keeps existing job if requested segment is near the encoding frontier', async () => {
		// First request: segment 0 doesn't exist, spawn ffmpeg
		mockSegmentState(new Set(), { appearAfterPolls: { segment: 0, polls: 2 } });
		mockSpawn.mockReturnValue(createMockProcess());

		await requestHlsSegment('/test/video.mkv', 1, 'high', 0);
		expect(mockSpawn).toHaveBeenCalledTimes(1);

		// Simulate ffmpeg has produced segments 0 and 1.
		// Frontier scan: 0 exists, 1 exists, 2 doesn't → frontier=2.
		// Requested segment 2 is at frontier (diff=0, within 3) → keep job.
		mockSegmentState(new Set([0, 1]), { appearAfterPolls: { segment: 2, polls: 4 } });

		await requestHlsSegment('/test/video.mkv', 1, 'high', 2);
		expect(mockSpawn).toHaveBeenCalledTimes(1); // no new spawn
	});

	it('kills and restarts when requested segment is far ahead of encoding frontier', async () => {
		// First request: segment 0
		mockSegmentState(new Set(), { appearAfterPolls: { segment: 0, polls: 2 } });

		const proc1 = createMockProcess();
		const proc2 = createMockProcess();
		mockSpawn.mockReturnValueOnce(proc1).mockReturnValueOnce(proc2);

		await requestHlsSegment('/test/video.mkv', 1, 'high', 0);
		expect(mockSpawn).toHaveBeenCalledTimes(1);

		// Simulate: segments 0-4 exist (frontier=5). Request segment 50.
		// 50 - 5 = 45, way beyond 3 → kill and restart.
		mockSegmentState(new Set([0, 1, 2, 3, 4]), { appearAfterPolls: { segment: 50, polls: 4 } });

		await requestHlsSegment('/test/video.mkv', 1, 'high', 50);
		expect(proc1.kill).toHaveBeenCalled();
		expect(mockSpawn).toHaveBeenCalledTimes(2);
	});

	it('kills existing ffmpeg and restarts when seeking backward', async () => {
		// First request: segment 10
		mockSegmentState(new Set(), { appearAfterPolls: { segment: 10, polls: 2 } });

		const proc1 = createMockProcess();
		const proc2 = createMockProcess();
		mockSpawn.mockReturnValueOnce(proc1).mockReturnValueOnce(proc2);

		await requestHlsSegment('/test/video.mkv', 1, 'high', 10);
		expect(mockSpawn).toHaveBeenCalledTimes(1);

		// Seek backward to segment 2. Frontier scan from start=10: segment 10 exists → frontier=11.
		// Requested=2, which is before the frontier → not in range → kill and restart.
		mockSegmentState(new Set([10]), { appearAfterPolls: { segment: 2, polls: 4 } });

		await requestHlsSegment('/test/video.mkv', 1, 'high', 2);
		expect(proc1.kill).toHaveBeenCalled();
		expect(mockSpawn).toHaveBeenCalledTimes(2);
	});

	it('cleans up job on ffmpeg close', async () => {
		mockSegmentState(new Set(), { appearAfterPolls: { segment: 0, polls: 2 } });

		const proc = createMockProcess();
		mockSpawn.mockReturnValue(proc);

		await requestHlsSegment('/test/video.mkv', 1, 'high', 0);
		expect(isHlsGenerating(1, 'high')).toBe(true);

		proc.emit('close', 0);
		expect(isHlsGenerating(1, 'high')).toBe(false);
	});
});
