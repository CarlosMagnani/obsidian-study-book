/**
 * Anthropic provider.
 *
 * Anthropic has no speech to text endpoint, so this provider only writes the
 * analysis. The structured answer is requested through a tool, which is the
 * supported way to force JSON on the Messages API.
 */

import { ANALYSIS_JSON_SCHEMA, parseAnalysis } from '../core/analysis.ts';
import { requestJson } from '../core/http.ts';
import { buildAnalysisPrompt } from '../core/prompt.ts';
import type { AnalyzeInput, Provider, ProviderContext } from './types.ts';

interface AnthropicResponse {
	content?: { type?: string; name?: string; input?: unknown }[];
}

const TOOL_NAME = 'save_analysis';

function trimBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

async function analyze(
	input: AnalyzeInput,
	context: ProviderContext,
): Promise<ReturnType<typeof parseAnalysis>> {
	const url = `${trimBaseUrl(context.baseUrl)}/messages`;
	const prompt = buildAnalysisPrompt({
		title: input.title,
		url: input.url,
		transcript: input.transcript.text,
		language: input.language,
		topics: input.topics,
	});

	const body = await requestJson<AnthropicResponse>(
		url,
		{
			method: 'POST',
			headers: {
				'x-api-key': context.apiKey,
				'anthropic-version': '2023-06-01',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: context.model,
				max_tokens: 8192,
				messages: [{ role: 'user', content: prompt }],
				tools: [
					{
						name: TOOL_NAME,
						description: 'Save the study notes extracted from the transcript.',
						input_schema: ANALYSIS_JSON_SCHEMA,
					},
				],
				tool_choice: { type: 'tool', name: TOOL_NAME },
			}),
		},
		{ fetchImpl: context.fetchImpl },
	);

	const toolUse = (body.content ?? []).find(
		(block) => block.type === 'tool_use' && block.name === TOOL_NAME,
	);
	if (!toolUse) {
		throw new Error('Anthropic returned no analysis content');
	}
	return parseAnalysis(toolUse.input);
}

export const anthropicProvider: Provider = {
	id: 'anthropic',
	label: 'Anthropic',
	canTranscribe: false,
	canAnalyze: true,
	analysisModelSuggestions: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
	transcriptionModelSuggestions: [],
	transcribe: async () => {
		throw new Error('Anthropic does not transcribe audio; use OpenAI or Gemini for that step');
	},
	analyze,
};
