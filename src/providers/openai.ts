/**
 * OpenAI provider: transcription on `/audio/transcriptions` and analysis on
 * `/chat/completions` with a strict JSON schema.
 */

import { ANALYSIS_JSON_SCHEMA, parseAnalysis } from '../core/analysis.ts';
import { HttpError, requestJson, requestText } from '../core/http.ts';
import { buildAnalysisPrompt } from '../core/prompt.ts';
import type {
	AnalyzeInput,
	Provider,
	ProviderContext,
	TranscribeInput,
	Transcript,
	TranscriptSegment,
} from './types.ts';

interface OpenAITranscriptionSegment {
	start?: number;
	end?: number;
	text?: string;
}

interface OpenAITranscriptionResponse {
	text?: string;
	language?: string;
	segments?: OpenAITranscriptionSegment[];
}

interface OpenAIChatResponse {
	choices?: { message?: { content?: string } }[];
}

function trimBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

/**
 * Uploads the audio as multipart form data.
 *
 * `FormData` and `Blob` exist in the Obsidian renderer and in Node, so the
 * same code works in the plugin and in the tests.
 */
function buildAudioForm(input: TranscribeInput, model: string, responseFormat: string): FormData {
	const form = new FormData();
	const blob = new Blob([input.audioBytes as unknown as BlobPart], { type: input.mimeType });
	form.append('file', blob, input.fileName);
	form.append('model', model);
	form.append('response_format', responseFormat);
	if (input.language) {
		form.append('language', input.language);
	}
	return form;
}

async function transcribe(
	input: TranscribeInput,
	context: ProviderContext,
): Promise<Transcript> {
	const url = `${trimBaseUrl(context.baseUrl)}/audio/transcriptions`;
	const init: RequestInit = {
		method: 'POST',
		headers: { Authorization: `Bearer ${context.apiKey}` },
	};

	let payload: OpenAITranscriptionResponse;
	try {
		const body = await requestText(
			url,
			{ ...init, body: buildAudioForm(input, context.model, 'verbose_json') },
			{ fetchImpl: context.fetchImpl },
		);
		payload = JSON.parse(body) as OpenAITranscriptionResponse;
	} catch (error) {
		// Not every transcription model supports the verbose format. The plain
		// format still returns the full text, just without timestamps.
		if (!(error instanceof HttpError) || error.status !== 400) {
			throw error;
		}
		const body = await requestText(
			url,
			{ ...init, body: buildAudioForm(input, context.model, 'json') },
			{ fetchImpl: context.fetchImpl },
		);
		payload = JSON.parse(body) as OpenAITranscriptionResponse;
	}

	const text = (payload.text ?? '').trim();
	if (!text) {
		throw new Error('OpenAI returned an empty transcription');
	}
	const segments: TranscriptSegment[] = (payload.segments ?? [])
		.map((segment) => ({
			start: Number(segment.start ?? 0),
			end: Number(segment.end ?? 0),
			text: (segment.text ?? '').trim(),
		}))
		.filter((segment) => segment.text.length > 0);

	return {
		sourceId: input.sourceId,
		language: payload.language ?? input.language ?? 'unknown',
		text,
		segments: segments.length > 0 ? segments : [{ start: 0, end: 0, text }],
	};
}

async function analyze(input: AnalyzeInput, context: ProviderContext): Promise<ReturnType<typeof parseAnalysis>> {
	const url = `${trimBaseUrl(context.baseUrl)}/chat/completions`;
	const prompt = buildAnalysisPrompt({
		title: input.title,
		url: input.url,
		transcript: input.transcript.text,
		language: input.language,
		topics: input.topics,
	});

	const body = await requestJson<OpenAIChatResponse>(
		url,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${context.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: context.model,
				messages: [{ role: 'user', content: prompt }],
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'study_analysis',
						strict: true,
						schema: ANALYSIS_JSON_SCHEMA,
					},
				},
			}),
		},
		{ fetchImpl: context.fetchImpl },
	);

	const content = body.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error('OpenAI returned no analysis content');
	}
	return parseAnalysis(content);
}

export const openaiProvider: Provider = {
	id: 'openai',
	label: 'OpenAI',
	canTranscribe: true,
	canAnalyze: true,
	analysisModelSuggestions: ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-6-luna', 'gpt-6-astra'],
	transcriptionModelSuggestions: ['gpt-transcribe', 'whisper-1', 'gpt-4o-transcribe'],
	transcribe,
	analyze,
};
