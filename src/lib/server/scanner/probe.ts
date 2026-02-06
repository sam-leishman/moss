import { spawn } from 'child_process';
import { getLogger } from '$lib/server/logging';

const logger = getLogger('probe');

export interface ProbeResult {
	duration: number | null;
	width: number | null;
	height: number | null;
	video_codec: string | null;
	audio_codec: string | null;
	container_format: string | null;
	bitrate: number | null;
}

interface FFProbeStream {
	codec_type?: string;
	codec_name?: string;
	width?: number;
	height?: number;
}

interface FFProbeFormat {
	format_name?: string;
	duration?: string;
	bit_rate?: string;
}

interface FFProbeOutput {
	streams?: FFProbeStream[];
	format?: FFProbeFormat;
}

export async function probeMediaFile(filePath: string): Promise<ProbeResult> {
	const output = await runFFProbe(filePath);

	if (!output) {
		return {
			duration: null,
			width: null,
			height: null,
			video_codec: null,
			audio_codec: null,
			container_format: null,
			bitrate: null
		};
	}

	const videoStream = output.streams?.find((s) => s.codec_type === 'video');
	const audioStream = output.streams?.find((s) => s.codec_type === 'audio');
	const format = output.format;

	const duration = format?.duration ? parseFloat(format.duration) : null;
	const bitrate = format?.bit_rate ? parseInt(format.bit_rate, 10) : null;

	// format_name can be comma-separated (e.g. "matroska,webm"), take the first
	const containerFormat = format?.format_name?.split(',')[0] ?? null;

	return {
		duration: duration !== null && !isNaN(duration) ? duration : null,
		width: videoStream?.width ?? null,
		height: videoStream?.height ?? null,
		video_codec: videoStream?.codec_name ?? null,
		audio_codec: audioStream?.codec_name ?? null,
		container_format: containerFormat,
		bitrate: bitrate !== null && !isNaN(bitrate) ? bitrate : null
	};
}

function runFFProbe(filePath: string): Promise<FFProbeOutput | null> {
	return new Promise((resolve) => {
		const ffprobe = spawn(
			'ffprobe',
			[
				'-v',
				'quiet',
				'-print_format',
				'json',
				'-show_format',
				'-show_streams',
				filePath
			],
			{ timeout: 15000 }
		);

		let stdout = '';
		let stderr = '';

		ffprobe.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		ffprobe.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		ffprobe.on('close', (code) => {
			if (code !== 0) {
				logger.warn(`ffprobe exited with code ${code} for ${filePath}: ${stderr}`);
				resolve(null);
				return;
			}

			try {
				const parsed = JSON.parse(stdout) as FFProbeOutput;
				resolve(parsed);
			} catch (err) {
				logger.warn(
					`Failed to parse ffprobe output for ${filePath}: ${err instanceof Error ? err.message : String(err)}`
				);
				resolve(null);
			}
		});

		ffprobe.on('error', (err) => {
			logger.warn(`ffprobe failed for ${filePath}: ${err.message}`);
			resolve(null);
		});
	});
}
