/**
 * Pipeline runner: URL to a ready to save study note.
 *
 * Every external dependency (network, yt-dlp, clock) is injectable, so the
 * whole flow can be exercised in the tests without leaving the machine.
 */

import { rm } from 'node:fs/promises';
import path from 'node:path';

import type { Analysis } from '../core/analysis.ts';
import type { FetchLike } from '../core/http.ts';
import type { ProviderId, StudyBookSettings } from '../core/settings.ts';
import { getProvider } from '../providers/index.ts';
import type { ProviderContext, Transcript } from '../providers/types.ts';
import { analyzeTranscript } from './analyze.ts';
import { downloadAudio } from './download.ts';
import { noteFileName, renderNote } from './note.ts';
import { transcribeAudio } from './transcribe.ts';

export interface RunOptions {
	url: string;
	settings: StudyBookSettings;
	/** Absolute path of the folder that receives the temporary files. */
	workDir: string;
	now?: Date;
	onProgress?: (message: string) => void;
	fetchImpl?: FetchLike;
	execFileImpl?: Parameters<typeof downloadAudio>[1]['execFileImpl'];
}

export interface RunResult {
	id: string;
	title: string;
	audioPath: string;
	transcript: Transcript;
	analysis: Analysis;
	noteFileName: string;
	noteContent: string;
	provider: ProviderId;
	model: string;
}

/**
 * Builds the context a provider needs for one call.
 */
export function providerContext(
	settings: StudyBookSettings,
	providerId: ProviderId,
	kind: 'analysis' | 'transcription',
	fetchImpl?: FetchLike,
): ProviderContext {
	const config = settings.providers[providerId];
	return {
		apiKey: config.apiKey.trim(),
		model: kind === 'analysis' ? config.analysisModel.trim() : config.transcriptionModel.trim(),
		baseUrl: config.baseUrl.trim(),
		fetchImpl: fetchImpl ?? (globalThis.fetch as FetchLike),
	};
}

/**
 * Runs the three stages and renders the note.
 */
export async function runPipeline(options: RunOptions): Promise<RunResult> {
	const { settings } = options;
	const report = options.onProgress ?? (() => {});

	const download = await downloadAudio(options.url, {
		ytDlpPath: settings.ytDlpPath,
		workDir: options.workDir,
		cookiesFromBrowser: settings.cookiesFromBrowser,
		cookieFile: settings.cookieFile,
		execFileImpl: options.execFileImpl,
		onProgress: report,
	});
	report(`Downloaded "${download.title}".`);

	const transcriptionProvider = getProvider(settings.transcriptionProvider);
	const transcript = await transcribeAudio(download.audioPath, {
		provider: transcriptionProvider,
		context: providerContext(
			settings,
			settings.transcriptionProvider,
			'transcription',
			options.fetchImpl,
		),
		sourceId: download.id,
	});
	report(`Transcribed ${transcript.text.length} characters.`);

	const analysisProvider = getProvider(settings.analysisProvider);
	const context = providerContext(settings, settings.analysisProvider, 'analysis', options.fetchImpl);
	const analysis = await analyzeTranscript(transcript, {
		provider: analysisProvider,
		context,
		title: download.title,
		url: download.webpageUrl,
		language: settings.outputLanguage,
		topics: settings.topics,
	});
	report(`Analysis ready: ${analysis.topic}.`);

	const noteContent = renderNote({
		title: download.title,
		url: download.webpageUrl,
		videoId: download.id,
		analysis,
		transcript,
		provider: settings.analysisProvider,
		model: context.model,
		createdAt: options.now ?? new Date(),
		includeTranscript: settings.includeTranscript,
	});

	if (!settings.keepAudio) {
		await rm(download.audioPath, { force: true });
	}

	return {
		id: download.id,
		title: download.title,
		audioPath: download.audioPath,
		transcript,
		analysis,
		noteFileName: noteFileName(download.title, download.id),
		noteContent,
		provider: settings.analysisProvider,
		model: context.model,
	};
}

/**
 * Builds the absolute path of the folder that keeps the temporary files.
 */
export function workDirFor(vaultRoot: string, settings: StudyBookSettings): string {
	const folder = settings.workFolder.trim() || '.study-book';
	return path.join(vaultRoot, folder);
}
