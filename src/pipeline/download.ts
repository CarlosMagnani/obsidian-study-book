/**
 * Download stage: URL to audio file, using yt-dlp.
 *
 * The binary is not bundled with the plugin. The user either has yt-dlp on
 * the PATH or points the settings to a custom executable.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

export interface DownloadOptions {
	/** Path to the yt-dlp executable, empty means "look on the PATH". */
	ytDlpPath: string;
	/** Directory that receives the audio file and the metadata file. */
	workDir: string;
	/** Browser name for `--cookies-from-browser`, empty to skip. */
	cookiesFromBrowser?: string;
	/** Netscape cookie file for `--cookies`, empty to skip. */
	cookieFile?: string;
	/** Milliseconds before the download is killed. */
	timeoutMs?: number;
	/** Called with human readable progress messages. */
	onProgress?: (message: string) => void;
	/** Injection point for the tests. */
	execFileImpl?: typeof execFile;
}

export interface DownloadResult {
	id: string;
	title: string;
	audioPath: string;
	duration: number;
	webpageUrl: string;
}

interface YtDlpInfo {
	id?: string;
	title?: string;
	duration?: number;
	webpage_url?: string;
	requested_downloads?: { filepath?: string }[];
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Finds a usable yt-dlp executable.
 *
 * The configured path wins; otherwise the PATH is searched.
 */
export async function findYtDlp(
	configuredPath = '',
	run: typeof execFile = execFile,
): Promise<string> {
	const candidates = configuredPath.trim()
		? [configuredPath.trim()]
		: process.platform === 'win32'
			? ['yt-dlp.exe', 'yt-dlp']
			: ['yt-dlp'];

	for (const candidate of candidates) {
		try {
			await run(candidate, ['--version'], { timeout: 15_000 });
			return candidate;
		} catch {
			// Try the next candidate.
		}
	}
	throw new Error(
		'yt-dlp was not found. Install it (https://github.com/yt-dlp/yt-dlp) and set the path in the plugin settings.',
	);
}

function assertHttpsUrl(url: string): string {
	const trimmed = url.trim();
	if (!/^https:\/\//i.test(trimmed)) {
		throw new Error('the URL must start with https://');
	}
	return trimmed;
}

/**
 * Downloads the audio of a video and returns where the file landed.
 */
export async function downloadAudio(
	url: string,
	options: DownloadOptions,
): Promise<DownloadResult> {
	const run = options.execFileImpl ?? execFile;
	const target = assertHttpsUrl(url);
	const executable = await findYtDlp(options.ytDlpPath, run);

	const args = [
		'--no-playlist',
		'--no-warnings',
		'--no-simulate',
		'--extract-audio',
		'--audio-format',
		'm4a',
		'--audio-quality',
		'0',
		'--write-info-json',
		'--print-json',
		'-f',
		'bestaudio/best',
		'-o',
		path.join(options.workDir, '%(id)s.%(ext)s'),
	];
	if (options.cookiesFromBrowser?.trim()) {
		args.push('--cookies-from-browser', options.cookiesFromBrowser.trim());
	}
	if (options.cookieFile?.trim()) {
		args.push('--cookies', options.cookieFile.trim());
	}
	args.push(target);

	options.onProgress?.(`Downloading with ${executable}…`);

	const { stdout } = await runPromise(run, executable, args, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

	let info: YtDlpInfo = {};
	try {
		info = JSON.parse(stdout) as YtDlpInfo;
	} catch {
		// Some builds print extra lines before the JSON payload.
		const start = stdout.indexOf('{');
		if (start >= 0) {
			try {
				info = JSON.parse(stdout.slice(start)) as YtDlpInfo;
			} catch {
				info = {};
			}
		}
	}

	const id = info.id ?? 'video';
	const audioPath = info.requested_downloads?.[0]?.filepath ?? (await findAudioFile(options.workDir, id));

	return {
		id,
		title: info.title?.trim() || id,
		audioPath,
		duration: typeof info.duration === 'number' ? info.duration : 0,
		webpageUrl: info.webpage_url ?? target,
	};
}

/**
 * Finds the audio file when yt-dlp did not report the final path.
 */
async function findAudioFile(workDir: string, id: string): Promise<string> {
	const entries = await readdir(workDir);
	const audio = entries.filter((entry) => entry.endsWith('.m4a'));
	const preferred = audio.find((entry) => entry.startsWith(id)) ?? audio[0];
	if (!preferred) {
		throw new Error('yt-dlp finished but no audio file was found');
	}
	return path.join(workDir, preferred);
}

/**
 * Promisified `execFile` that keeps stdout and stderr separated.
 */
function runPromise(
	run: typeof execFile,
	command: string,
	args: string[],
	timeout: number,
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		run(
			command,
			args,
			{ timeout, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
			(error, stdout, stderr) => {
				if (error) {
					const detail = typeof stderr === 'string' ? stderr.trim() : '';
					reject(new Error(detail || (error as Error).message));
					return;
				}
				resolve({ stdout: String(stdout), stderr: String(stderr) });
			},
		);
	});
}

/**
 * Tells whether the configured executable exists on disk.
 */
export function ytDlpExists(configuredPath: string): boolean {
	return configuredPath.trim().length > 0 && existsSync(configuredPath.trim());
}
