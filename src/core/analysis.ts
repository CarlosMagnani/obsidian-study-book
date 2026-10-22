/**
 * Analysis contract: the stable shape every provider must return.
 *
 * It mirrors the JSON produced by the Python `study_book` project so a note
 * written by the plugin and a note written by the CLI describe the same
 * study material.
 */

export interface SourceTimestamp {
	start: number;
	end: number;
	label: string;
}

export interface Analysis {
	topic: string;
	summary: string;
	key_points: string[];
	timestamps: SourceTimestamp[];
	language: string;
}

/**
 * JSON Schema sent to providers that support structured outputs.
 *
 * `additionalProperties: false` plus every field in `required` is what the
 * OpenAI strict mode requires, so the same schema is reused everywhere.
 */
export const ANALYSIS_JSON_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['topic', 'summary', 'key_points', 'timestamps', 'language'],
	properties: {
		topic: { type: 'string', description: 'Short topic label for the video.' },
		summary: { type: 'string', description: 'Concise summary of the main idea.' },
		key_points: {
			type: 'array',
			items: { type: 'string' },
			description: 'The most important takeaways, one per entry.',
		},
		timestamps: {
			type: 'array',
			description: 'Optional moments in the video that illustrate a key point.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['start', 'end', 'label'],
				properties: {
					start: { type: 'number', description: 'Start of the moment in seconds.' },
					end: { type: 'number', description: 'End of the moment in seconds.' },
					label: { type: 'string', description: 'What happens in this moment.' },
				},
			},
		},
		language: { type: 'string', description: 'Language of the summary, as an IETF tag.' },
	},
} as const;

export class AnalysisError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AnalysisError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Validates the raw provider payload and returns the analysis contract.
 *
 * Providers occasionally answer with a missing field or a stringified number;
 * instead of failing the whole run we coerce the safe cases and complain
 * only when a required piece of content is absent.
 */
export function parseAnalysis(value: unknown): Analysis {
	if (typeof value === 'string') {
		try {
			return parseAnalysis(JSON.parse(value));
		} catch (error) {
			throw new AnalysisError(
				`provider did not return valid JSON: ${(error as Error).message}`,
			);
		}
	}
	if (!isRecord(value)) {
		throw new AnalysisError('provider returned an empty analysis');
	}

	const topic = asString(value.topic);
	const summary = asString(value.summary);
	if (!topic || !summary) {
		throw new AnalysisError('provider returned an analysis without topic or summary');
	}

	const keyPoints = Array.isArray(value.key_points)
		? value.key_points.map((item) => asString(item)).filter((item) => item.length > 0)
		: [];

	const timestamps = Array.isArray(value.timestamps)
		? value.timestamps.filter(isRecord).map((item) => ({
				start: asNumber(item.start),
				end: asNumber(item.end),
				label: asString(item.label),
			}))
		: [];

	return {
		topic,
		summary,
		key_points: keyPoints,
		timestamps,
		language: asString(value.language, 'unknown'),
	};
}
