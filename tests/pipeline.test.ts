import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { normalizeSettings } from '../src/core/settings.ts';
import { runPipeline } from '../src/pipeline/run.ts';
import { fakeFetch } from './helpers/fakes.ts';

interface ExecCall {
	command: string;
	args: string[];
}

/**
 * A fake `execFile` that answers the version check and the download.
 */
function fakeExecFile(audioPath: string): {
	calls: ExecCall[];
	impl: NonNullable<Parameters<typeof runPipeline>[0]['execFileImpl']>;
} {
	const calls: ExecCall[] = [];
	const impl = ((
		command: string,
		args: string[],
		_options: unknown,
		callback?: (error: Error | null, stdout: string, stderr: string) => void,
	) => {
		calls.push({ command, args });
		if (!callback) {
			return {} as never;
		}
		const stdout = JSON.stringify({
			id: 'abc123',
			title: 'How sleep works',
			duration: 120,
			webpage_url: 'https://example.com/reel/abc123',
			requested_downloads: [{ filepath: audioPath }],
		});
		callback(null, stdout, '');
		return {} as never;
	}) as unknown as NonNullable<Parameters<typeof runPipeline>[0]['execFileImpl']>;
	return { calls, impl };
}

describe('runPipeline', () => {
	it('downloads, transcribes, analyses and renders the note', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'study-book-'));
		const audioPath = path.join(workDir, 'abc123.m4a');
		await writeFile(audioPath, 'fake audio bytes');

		const fake = fakeFetch([
			{
				body: {
					text: 'Hello world',
					language: 'en',
					segments: [{ start: 0, end: 2, text: 'Hello world' }],
				},
			},
			{
				body: {
					choices: [
						{
							message: {
								content: JSON.stringify({
									topic: 'Sleep',
									summary: 'The video explains the sleep cycles.',
									key_points: ['Deep sleep happens early.'],
									timestamps: [],
									language: 'en',
								}),
							},
						},
					],
				},
			},
		]);

		const settings = normalizeSettings({
			providers: { openai: { apiKey: 'sk-test' } },
			notesFolder: 'Study Book',
		});

		const progress: string[] = [];
		const result = await runPipeline({
			url: 'https://example.com/reel/abc123',
			settings,
			workDir,
			fetchImpl: fake.fetchImpl,
			execFileImpl: fakeExecFile(audioPath).impl,
			now: new Date('2026-10-22T10:00:00.000Z'),
			onProgress: (message) => progress.push(message),
		});

		assert.equal(result.title, 'How sleep works');
		assert.equal(result.id, 'abc123');
		assert.equal(result.transcript.text, 'Hello world');
		assert.equal(result.analysis.topic, 'Sleep');
		assert.equal(result.noteFileName, 'How sleep works.md');
		assert.match(result.noteContent, /topic: "Sleep"/);
		assert.match(result.noteContent, /The video explains the sleep cycles\./);
		assert.ok(progress.some((message) => message.includes('Downloaded')));
		assert.ok(progress.some((message) => message.includes('Transcribed')));
		assert.ok(progress.some((message) => message.includes('Analysis ready')));
	});

	it('refuses a URL that is not https', async () => {
		const settings = normalizeSettings({ providers: { openai: { apiKey: 'sk-test' } } });
		await assert.rejects(
			() =>
				runPipeline({
					url: 'file:///etc/passwd',
					settings,
					workDir: '/tmp',
				}),
			/https:\/\//,
		);
	});
});
