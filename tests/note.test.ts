import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatTimestamp, noteFileName, renderNote } from '../src/pipeline/note.ts';

const analysis = {
	topic: 'Sleep',
	summary: 'The video explains the sleep cycles.',
	key_points: ['Deep sleep happens early.', 'REM sleep gets longer.'],
	timestamps: [{ start: 12, end: 45, label: 'The first deep sleep block' }],
	language: 'en',
};

const transcript = {
	sourceId: 'abc123',
	language: 'en',
	text: 'Hello world',
	segments: [{ start: 0, end: 2, text: 'Hello world' }],
};

describe('renderNote', () => {
	const note = renderNote({
		title: 'How sleep works',
		url: 'https://example.com/reel/abc123',
		videoId: 'abc123',
		analysis,
		transcript,
		provider: 'openai',
		model: 'gpt-5.6-luna',
		createdAt: new Date('2026-10-22T10:00:00.000Z'),
		includeTranscript: true,
	});

	it('starts with the frontmatter', () => {
		assert.ok(note.startsWith('---\n'));
		assert.match(note, /title: "How sleep works"/);
		assert.match(note, /video_id: "abc123"/);
		assert.match(note, /topic: "Sleep"/);
		assert.match(note, /provider: "openai"/);
		assert.match(note, /created: "2026-10-22T10:00:00.000Z"/);
		assert.match(note, / {2}- study-book/);
	});

	it('contains the summary, the key points and the moments', () => {
		assert.match(note, /> \[!abstract\] Summary/);
		assert.match(note, /The video explains the sleep cycles\./);
		assert.match(note, /- Deep sleep happens early\./);
		assert.match(note, /\*\*00:12\*\* The first deep sleep block/);
	});

	it('links the source and keeps the transcript', () => {
		assert.match(note, /\[How sleep works\]\(https:\/\/example\.com\/reel\/abc123\)/);
		assert.match(note, /<details>/);
		assert.match(note, /> Hello world/);
	});

	it('leaves the transcript out when it is not wanted', () => {
		const withoutTranscript = renderNote({
			title: 'How sleep works',
			url: 'https://example.com/reel/abc123',
			videoId: 'abc123',
			analysis,
			transcript,
			provider: 'openai',
			model: 'gpt-5.6-luna',
			createdAt: new Date('2026-10-22T10:00:00.000Z'),
			includeTranscript: false,
		});
		assert.ok(!withoutTranscript.includes('<details>'));
	});
});

describe('formatTimestamp', () => {
	it('formats seconds as mm:ss', () => {
		assert.equal(formatTimestamp(0), '00:00');
		assert.equal(formatTimestamp(9), '00:09');
		assert.equal(formatTimestamp(75), '01:15');
		assert.equal(formatTimestamp(-4), '00:00');
	});
});

describe('noteFileName', () => {
	it('removes the characters that are not allowed in a file name', () => {
		assert.equal(noteFileName('Café: o que é?', 'abc'), 'Café o que é.md');
	});

	it('falls back to the video id when the title is empty', () => {
		assert.equal(noteFileName('   ', 'abc123'), 'Study abc123.md');
	});
});
