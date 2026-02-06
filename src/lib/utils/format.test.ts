import { describe, it, expect } from 'vitest';
import { formatDuration, formatBitrate } from './format';

describe('formatDuration', () => {
	it('formats seconds-only durations', () => {
		expect(formatDuration(0)).toBe('0:00');
		expect(formatDuration(5)).toBe('0:05');
		expect(formatDuration(45)).toBe('0:45');
	});

	it('formats minutes and seconds', () => {
		expect(formatDuration(60)).toBe('1:00');
		expect(formatDuration(90)).toBe('1:30');
		expect(formatDuration(605)).toBe('10:05');
	});

	it('formats hours, minutes, and seconds', () => {
		expect(formatDuration(3600)).toBe('1:00:00');
		expect(formatDuration(3661)).toBe('1:01:01');
		expect(formatDuration(7384)).toBe('2:03:04');
	});

	it('pads minutes and seconds with leading zeros', () => {
		expect(formatDuration(3601)).toBe('1:00:01');
		expect(formatDuration(3660)).toBe('1:01:00');
		expect(formatDuration(62)).toBe('1:02');
	});

	it('truncates fractional seconds', () => {
		expect(formatDuration(90.7)).toBe('1:30');
		expect(formatDuration(3661.999)).toBe('1:01:01');
	});

	it('handles edge cases', () => {
		expect(formatDuration(-1)).toBe('Unknown');
		expect(formatDuration(Infinity)).toBe('Unknown');
		expect(formatDuration(NaN)).toBe('Unknown');
	});
});

describe('formatBitrate', () => {
	it('formats megabit-range bitrates', () => {
		expect(formatBitrate(4_500_000)).toBe('4.5 Mbps');
		expect(formatBitrate(1_000_000)).toBe('1.0 Mbps');
		expect(formatBitrate(50_000_000)).toBe('50.0 Mbps');
	});

	it('formats kilobit-range bitrates', () => {
		expect(formatBitrate(128_000)).toBe('128 Kbps');
		expect(formatBitrate(320_000)).toBe('320 Kbps');
		expect(formatBitrate(1_000)).toBe('1 Kbps');
	});

	it('formats sub-kilobit bitrates', () => {
		expect(formatBitrate(500)).toBe('500 bps');
		expect(formatBitrate(1)).toBe('1 bps');
	});

	it('handles edge cases', () => {
		expect(formatBitrate(0)).toBe('Unknown');
		expect(formatBitrate(-100)).toBe('Unknown');
		expect(formatBitrate(Infinity)).toBe('Unknown');
		expect(formatBitrate(NaN)).toBe('Unknown');
	});
});
