/**
 * The prompt shared by every analysis provider.
 *
 * Keeping it in one place means the notes look the same no matter which
 * provider produced them.
 */

export interface PromptInput {
	title: string;
	url: string;
	transcript: string;
	language: string;
	topics: string[];
}

/**
 * Builds the instruction sent to the analysis model.
 *
 * The model must answer with the analysis JSON schema, so the prompt only
 * describes the content, never the shape.
 */
export function buildAnalysisPrompt(input: PromptInput): string {
	const lines: string[] = [
		'You turn a video transcript into study material.',
		'',
		`Title: ${input.title || 'unknown'}`,
		`Source: ${input.url}`,
		'',
		'Write the notes in this language: ' + input.language + '.',
	];
	if (input.topics.length > 0) {
		lines.push(
			'',
			`Classify the topic using only these labels: ${input.topics.join(', ')}.`,
			'If none of them fits, use the closest one and mention the mismatch in the summary.',
		);
	} else {
		lines.push('', 'Invent a short, specific topic label for the video.');
	}
	lines.push(
		'',
		'Rules:',
		'- The summary explains the main idea in a few sentences, in your own words.',
		'- Every key point is a standalone sentence a learner can reuse.',
		'- Timestamps are optional: include them only when the transcript shows the exact moment.',
		'- Never invent facts that are not in the transcript.',
		'',
		'Transcript:',
		'"""',
		input.transcript,
		'"""',
	);
	return lines.join('\n');
}

/**
 * Builds the instruction sent to a transcription provider.
 */
export function buildTranscriptionPrompt(language: string): string {
	return [
		'Transcribe the attached audio.',
		'Write the spoken words as plain text, without speaker labels or commentary.',
		'Mark the beginning of every sentence with its timestamp in the [mm:ss] format.',
		`Keep the original language of the audio${language ? ` (expected: ${language})` : ''}.`,
	].join('\n');
}
