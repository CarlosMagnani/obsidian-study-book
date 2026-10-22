/**
 * Analysis stage: transcript to study notes, through the BYOK provider.
 */

import type { Analysis } from '../core/analysis.ts';
import type { Provider, ProviderContext, Transcript } from '../providers/types.ts';

export interface AnalyzeOptions {
	provider: Provider;
	context: ProviderContext;
	title: string;
	url: string;
	language: string;
	topics: string[];
}

/**
 * Asks the provider to write the study notes and validates the answer.
 */
export async function analyzeTranscript(
	transcript: Transcript,
	options: AnalyzeOptions,
): Promise<Analysis> {
	return options.provider.analyze(
		{
			title: options.title,
			url: options.url,
			transcript,
			language: options.language,
			topics: options.topics,
		},
		options.context,
	);
}
