/**
 * Google Gemini provider.
 *
 * Gemini reads the audio directly (multimodal) and writes the analysis with
 * a response schema. It has no native timestamps, so the transcription prompt
 * asks for `[mm:ss]` markers that the provider layer turns into segments.
 */

import { ANALYSIS_JSON_SCHEMA, parseAnalysis } from '../core/analysis.ts';
import { requestJson, toBase64 } from '../core/http.ts';
import { buildAnalysisPrompt, buildTranscriptionPrompt } from '../core/prompt.ts';
import {
	parseTimestampedText,
	stripTimestampMarkers,
	type AnalyzeInput,
	type Provider,
	type ProviderContext,
	type TranscribeInput,
	type Transcript,
} from './types.ts';

interface GeminiResponse {
	candidates?: {
		content?: { parts?: GeminiPart[] };
		finishReason?: string;
	}[];
}

interface GeminiPart {
	text?: string;
}

/**
 * Gemini rejects the `additionalProperties` keyword, so the schema is sent
 * without it. Everything else is the same contract used elsewhere.
 */
function geminiSchema(): Record<string, unknown> {
	const schema = JSON.parse(JSON.stringify(ANALYSIS_JSON_SCHEMA)) as Record<string, unknown>;
	delete schema.additionalProperties;
	const properties = schema.properties as Record<string, Record<string, unknown>>;
	const timestamps = properties.timestamps as Record<string, unknown>;
	const items = timestamps.items as Record<string, unknown>;
	delete items.additionalProperties;
	return schema;
}

function trimBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

function partsToText(response: GeminiResponse): string {
	return (response.candidates?.[0]?.content?.parts ?? [])
		.map((part) => part.text ?? '')
		.join('')
		.trim();
}

async function transcribe(
	input: TranscribeInput,
	context: ProviderContext,
): Promise<Transcript> {
	const url = `${trimBaseUrl(context.baseUrl)}/models/${encodeURIComponent(context.model)}:generateContent`;
	const body = await requestJson<GeminiResponse>(
		url,
		{
			method: 'POST',
			headers: {
				'x-goog-api-key': context.apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{
								inline_data: {
									mime_type: input.mimeType,
									data: toBase64(input.audioBytes),
								},
							},
							{ text: buildTranscriptionPrompt(input.language) },
						],
					},
				],
			}),
		},
		{ fetchImpl: context.fetchImpl },
	);

	const raw = partsToText(body);
	if (!raw) {
		throw new Error('Gemini returned an empty transcription');
	}
	const segments = parseTimestampedText(raw);
	return {
		sourceId: input.sourceId,
		language: input.language || 'unknown',
		text: stripTimestampMarkers(raw) || raw,
		segments,
	};
}

async function analyze(
	input: AnalyzeInput,
	context: ProviderContext,
): Promise<ReturnType<typeof parseAnalysis>> {
	const url = `${trimBaseUrl(context.baseUrl)}/models/${encodeURIComponent(context.model)}:generateContent`;
	const prompt = buildAnalysisPrompt({
		title: input.title,
		url: input.url,
		transcript: input.transcript.text,
		language: input.language,
		topics: input.topics,
	});

	const body = await requestJson<GeminiResponse>(
		url,
		{
			method: 'POST',
			headers: {
				'x-goog-api-key': context.apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: {
					responseMimeType: 'application/json',
					responseSchema: geminiSchema(),
				},
			}),
		},
		{ fetchImpl: context.fetchImpl },
	);

	const raw = partsToText(body);
	if (!raw) {
		throw new Error('Gemini returned no analysis content');
	}
	return parseAnalysis(raw);
}

export const geminiProvider: Provider = {
	id: 'gemini',
	label: 'Google Gemini',
	canTranscribe: true,
	canAnalyze: true,
	analysisModelSuggestions: ['gemini-3.8-flash', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview'],
	transcriptionModelSuggestions: ['gemini-3.8-flash', 'gemini-3-flash-preview'],
	transcribe,
	analyze,
};
