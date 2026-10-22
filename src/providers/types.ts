/**
 * Provider contract.
 *
 * A provider is the only place that knows how to talk to one API. Everything
 * else (pipeline, note, settings) works with these interfaces.
 */

import type { Analysis } from '../core/analysis.ts';
import type { FetchLike } from '../core/http.ts';
import type { ProviderId } from '../core/settings.ts';

export interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
}

export interface Transcript {
	sourceId: string;
	language: string;
	text: string;
	segments: TranscriptSegment[];
}

export interface TranscribeInput {
	/** Absolute path of the audio file, used for error messages. */
	audioPath: string;
	/** Raw audio bytes, sent to the provider. */
	audioBytes: Uint8Array;
	/** MIME type of the audio, for example `audio/mp4`. */
	mimeType: string;
	/** File name sent to the provider, for example `audio.m4a`. */
	fileName: string;
	/** Identifier of the video, used as the transcript source id. */
	sourceId: string;
	/** Language hint for the transcription, empty when unknown. */
	language: string;
}

export interface AnalyzeInput {
	title: string;
	url: string;
	transcript: Transcript;
	language: string;
	topics: string[];
}

export interface ProviderContext {
	apiKey: string;
	/** Model used by the current call (analysis or transcription). */
	model: string;
	/** Base URL of the API, without the endpoint path. */
	baseUrl: string;
	fetchImpl: FetchLike;
}

export interface Provider {
	id: ProviderId;
	label: string;
	/** Whether the API can turn audio into text. */
	canTranscribe: boolean;
	/** Whether the API can write the study analysis. */
	canAnalyze: boolean;
	/** Suggestions shown in the settings screen. */
	analysisModelSuggestions: string[];
	transcriptionModelSuggestions: string[];
	transcribe(input: TranscribeInput, context: ProviderContext): Promise<Transcript>;
	analyze(input: AnalyzeInput, context: ProviderContext): Promise<Analysis>;
}

/**
 * Parses `[mm:ss]` markers written by a transcription model into segments.
 *
 * Providers without native timestamps (Gemini) are asked to mark the
 * sentences, and this turns those markers into the same contract the other
 * providers return.
 */
export function parseTimestampedText(text: string): TranscriptSegment[] {
	const pattern = /\[(\d{1,2}):(\d{2})\]/g;
	const segments: TranscriptSegment[] = [];
	let lastIndex = 0;
	let lastStart: number | null = null;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text)) !== null) {
		const start = Number(match[1]) * 60 + Number(match[2]);
		const chunk = text.slice(lastIndex, match.index).trim();
		if (chunk) {
			segments.push({
				start: lastStart ?? 0,
				end: start,
				text: chunk,
			});
		}
		lastStart = start;
		lastIndex = match.index + match[0].length;
	}

	const tail = text.slice(lastIndex).trim();
	if (tail) {
		segments.push({ start: lastStart ?? 0, end: lastStart ?? 0, text: tail });
	}

	if (segments.length === 0 && text.trim()) {
		return [{ start: 0, end: 0, text: text.trim() }];
	}
	return segments;
}

/**
 * Removes the `[mm:ss]` markers from the text, keeping the plain transcript.
 */
export function stripTimestampMarkers(text: string): string {
	return text.replace(/\[\d{1,2}:\d{2}\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
