/**
 * Note renderer: turns the pipeline result into a Markdown note.
 *
 * The renderer is a pure function so the tests can check the exact file
 * content without touching the vault.
 */

import type { Analysis, SourceTimestamp } from '../core/analysis.ts';
import type { Transcript } from '../providers/types.ts';

export interface NoteInput {
	title: string;
	url: string;
	videoId: string;
	analysis: Analysis;
	transcript?: Transcript;
	provider: string;
	model: string;
	createdAt: Date;
	includeTranscript: boolean;
}

/**
 * Formats a number of seconds as `mm:ss`.
 */
export function formatTimestamp(seconds: number): string {
	const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
	const minutes = Math.floor(safe / 60);
	const rest = safe % 60;
	return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * Builds a file name that is safe on every operating system.
 */
export function noteFileName(title: string, videoId: string): string {
	const cleaned = title
		.replace(/[\\/:*?"<>|]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80);
	const base = cleaned.length > 0 ? cleaned : `Study ${videoId}`;
	return `${base}.md`;
}

/**
 * Renders the whole note, frontmatter included.
 */
export function renderNote(input: NoteInput): string {
	const { analysis } = input;
	const lines: string[] = [];

	lines.push('---');
	lines.push(`title: ${JSON.stringify(input.title)}`);
	lines.push(`source: ${JSON.stringify(input.url)}`);
	lines.push(`video_id: ${JSON.stringify(input.videoId)}`);
	lines.push(`topic: ${JSON.stringify(analysis.topic)}`);
	lines.push(`language: ${JSON.stringify(analysis.language)}`);
	lines.push(`provider: ${JSON.stringify(input.provider)}`);
	lines.push(`model: ${JSON.stringify(input.model)}`);
	lines.push(`created: ${JSON.stringify(input.createdAt.toISOString())}`);
	lines.push('tags:');
	lines.push('  - study-book');
	lines.push('---');
	lines.push('');
	lines.push(`# ${input.title}`);
	lines.push('');
	lines.push('> [!abstract] Summary');
	for (const line of analysis.summary.split('\n')) {
		lines.push(`> ${line}`.trimEnd());
	}
	lines.push('');

	if (analysis.key_points.length > 0) {
		lines.push('## Key points');
		lines.push('');
		for (const point of analysis.key_points) {
			lines.push(`- ${point}`);
		}
		lines.push('');
	}

	if (analysis.timestamps.length > 0) {
		lines.push('## Moments');
		lines.push('');
		for (const moment of analysis.timestamps) {
			lines.push(`- **${formatTimestamp(moment.start)}** ${moment.label}`);
		}
		lines.push('');
	}

	lines.push('## Source');
	lines.push('');
	lines.push(`- [${input.title}](${input.url})`);
	lines.push('');

	if (input.includeTranscript && input.transcript?.text) {
		lines.push('## Transcript');
		lines.push('');
		lines.push('<details>');
		lines.push('<summary>Show transcript</summary>');
		lines.push('');
		for (const line of input.transcript.text.split('\n')) {
			lines.push(`> ${line}`.trimEnd());
		}
		lines.push('');
		lines.push('</details>');
		lines.push('');
	}

	return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Sums the duration of the recorded moments, used by the summary line.
 */
export function totalMomentDuration(timestamps: SourceTimestamp[]): number {
	return timestamps.reduce((total, moment) => total + Math.max(0, moment.end - moment.start), 0);
}
