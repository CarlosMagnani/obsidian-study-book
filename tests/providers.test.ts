import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fakeFetch, requestForm, requestJson } from './helpers/fakes.ts';
import { anthropicProvider } from '../src/providers/anthropic.ts';
import { geminiProvider } from '../src/providers/gemini.ts';
import { openaiProvider } from '../src/providers/openai.ts';

const AUDIO = new Uint8Array([1, 2, 3, 4, 5]);

describe('OpenAI provider', () => {
	it('uploads the audio and returns the transcript with segments', async () => {
		const fake = fakeFetch([
			{
				body: {
					text: 'Hello world',
					language: 'en',
					segments: [{ start: 0, end: 2.5, text: 'Hello world' }],
				},
			},
		]);

		const transcript = await openaiProvider.transcribe(
			{
				audioPath: '/tmp/audio.m4a',
				audioBytes: AUDIO,
				mimeType: 'audio/mp4',
				fileName: 'audio.m4a',
				sourceId: 'abc123',
				language: '',
			},
			{
				apiKey: 'sk-test',
				model: 'gpt-transcribe',
				baseUrl: 'https://api.openai.com/v1',
				fetchImpl: fake.fetchImpl,
			},
		);

		assert.equal(fake.requests[0]?.url, 'https://api.openai.com/v1/audio/transcriptions');
		const headers = fake.requests[0]?.init.headers as Record<string, string>;
		assert.equal(headers.Authorization, 'Bearer sk-test');
		const form = await requestForm(fake.requests[0]!);
		assert.equal(form.get('model'), 'gpt-transcribe');
		assert.equal(form.get('response_format'), 'verbose_json');
		assert.equal(transcript.text, 'Hello world');
		assert.equal(transcript.segments[0]?.end, 2.5);
	});

	it('falls back to the plain format when the verbose one is refused', async () => {
		const fake = fakeFetch([
			{ status: 400, body: { error: { message: 'response_format is not supported' } } },
			{ body: { text: 'Plain transcript' } },
		]);

		const transcript = await openaiProvider.transcribe(
			{
				audioPath: '/tmp/audio.m4a',
				audioBytes: AUDIO,
				mimeType: 'audio/mp4',
				fileName: 'audio.m4a',
				sourceId: 'abc123',
				language: '',
			},
			{
				apiKey: 'sk-test',
				model: 'gpt-transcribe',
				baseUrl: 'https://api.openai.com/v1',
				fetchImpl: fake.fetchImpl,
			},
		);

		assert.equal(fake.requests.length, 2);
		assert.equal(transcript.text, 'Plain transcript');
		assert.equal(transcript.segments.length, 1);
	});

	it('asks for a strict JSON schema on the analysis call', async () => {
		const fake = fakeFetch([
			{
				body: {
					choices: [
						{
							message: {
								content: JSON.stringify({
									topic: 'Sleep',
									summary: 'About sleep.',
									key_points: ['One point.'],
									timestamps: [],
									language: 'en',
								}),
							},
						},
					],
				},
			},
		]);

		const analysis = await openaiProvider.analyze(
			{
				title: 'A video',
				url: 'https://example.com/video',
				transcript: { sourceId: 'abc', language: 'en', text: 'hello', segments: [] },
				language: 'same as the source',
				topics: [],
			},
			{
				apiKey: 'sk-test',
				model: 'gpt-5.6-luna',
				baseUrl: 'https://api.openai.com/v1',
				fetchImpl: fake.fetchImpl,
			},
		);

		const body = requestJson(fake.requests[0]!);
		const responseFormat = body.response_format as Record<string, unknown>;
		assert.equal(responseFormat.type, 'json_schema');
		const schema = (responseFormat.json_schema as Record<string, unknown>).schema as Record<
			string,
			unknown
		>;
		assert.equal(schema.additionalProperties, false);
		assert.equal(analysis.topic, 'Sleep');
		assert.equal(analysis.key_points[0], 'One point.');
	});
});

describe('Anthropic provider', () => {
	it('requests the analysis through a tool', async () => {
		const fake = fakeFetch([
			{
				body: {
					content: [
						{
							type: 'tool_use',
							name: 'save_analysis',
							input: {
								topic: 'Cafe',
								summary: 'Sobre cafe.',
								key_points: [],
								timestamps: [],
								language: 'pt',
							},
						},
					],
				},
			},
		]);

		const analysis = await anthropicProvider.analyze(
			{
				title: 'A video',
				url: 'https://example.com/video',
				transcript: { sourceId: 'abc', language: 'pt', text: 'olá', segments: [] },
				language: 'pt-BR',
				topics: [],
			},
			{
				apiKey: 'sk-ant-test',
				model: 'claude-sonnet-5-5',
				baseUrl: 'https://api.anthropic.com/v1',
				fetchImpl: fake.fetchImpl,
			},
		);

		assert.equal(fake.requests[0]?.url, 'https://api.anthropic.com/v1/messages');
		const headers = fake.requests[0]?.init.headers as Record<string, string>;
		assert.equal(headers['x-api-key'], 'sk-ant-test');
		assert.equal(headers['anthropic-version'], '2023-06-01');
		const body = requestJson(fake.requests[0]!);
		assert.equal((body.tool_choice as Record<string, unknown>).type, 'tool');
		assert.equal(analysis.topic, 'Cafe');
	});

	it('refuses to transcribe', async () => {
		assert.equal(anthropicProvider.canTranscribe, false);
		await assert.rejects(() =>
			anthropicProvider.transcribe(
				{
					audioPath: '/tmp/audio.m4a',
					audioBytes: AUDIO,
					mimeType: 'audio/mp4',
					fileName: 'audio.m4a',
					sourceId: 'abc',
					language: '',
				},
				{
					apiKey: 'k',
					model: 'm',
					baseUrl: 'https://api.anthropic.com/v1',
					fetchImpl: fakeFetch([]).fetchImpl,
				},
			),
		);
	});
});

describe('Gemini provider', () => {
	it('sends the audio inline and turns the markers into segments', async () => {
		const fake = fakeFetch([
			{
				body: {
					candidates: [
						{
							content: {
								parts: [{ text: '[00:00] Hello\n[00:05] world' }],
							},
						},
					],
				},
			},
		]);

		const transcript = await geminiProvider.transcribe(
			{
				audioPath: '/tmp/audio.m4a',
				audioBytes: AUDIO,
				mimeType: 'audio/mp4',
				fileName: 'audio.m4a',
				sourceId: 'abc123',
				language: '',
			},
			{
				apiKey: 'gemini-test',
				model: 'gemini-3.8-flash',
				baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
				fetchImpl: fake.fetchImpl,
			},
		);

		assert.equal(
			fake.requests[0]?.url,
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
		);
		const body = requestJson(fake.requests[0]!);
		const parts = (body.contents as { parts: { inline_data?: { data?: string } }[] }[])[0]?.parts;
		assert.equal(typeof parts?.[0]?.inline_data?.data, 'string');
		assert.equal(transcript.segments.length, 2);
		assert.equal(transcript.segments[1]?.start, 5);
		assert.equal(transcript.text, 'Hello world');
	});

	it('asks for a JSON response on the analysis call', async () => {
		const fake = fakeFetch([
			{
				body: {
					candidates: [
						{
							content: {
								parts: [
									{
										text: JSON.stringify({
											topic: 'Cafe',
											summary: 'Sobre cafe.',
											key_points: ['Um ponto.'],
											timestamps: [],
											language: 'pt',
										}),
									},
								],
							},
						},
					],
				},
			},
		]);

		const analysis = await geminiProvider.analyze(
			{
				title: 'A video',
				url: 'https://example.com/video',
				transcript: { sourceId: 'abc', language: 'pt', text: 'olá', segments: [] },
				language: 'pt-BR',
				topics: [],
			},
			{
				apiKey: 'gemini-test',
				model: 'gemini-3.8-flash',
				baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
				fetchImpl: fake.fetchImpl,
			},
		);

		const body = requestJson(fake.requests[0]!);
		const generationConfig = body.generationConfig as Record<string, unknown>;
		assert.equal(generationConfig.responseMimeType, 'application/json');
		const schema = generationConfig.responseSchema as Record<string, unknown>;
		assert.equal(schema.additionalProperties, undefined);
		assert.equal(analysis.topic, 'Cafe');
	});
});
