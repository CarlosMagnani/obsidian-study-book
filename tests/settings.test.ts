import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	DEFAULT_SETTINGS,
	describeMissingCredentials,
	normalizeSettings,
} from '../src/core/settings.ts';

describe('normalizeSettings', () => {
	it('returns the defaults when nothing was saved', () => {
		const settings = normalizeSettings(null);
		assert.equal(settings.analysisProvider, 'openai');
		assert.equal(settings.transcriptionProvider, 'openai');
		assert.equal(settings.providers.openai.analysisModel, 'gpt-5.6-luna');
		assert.equal(settings.providers.openai.baseUrl, 'https://api.openai.com/v1');
	});

	it('keeps the stored values', () => {
		const settings = normalizeSettings({
			analysisProvider: 'gemini',
			transcriptionProvider: 'gemini',
			providers: { gemini: { apiKey: 'key-123', analysisModel: 'gemini-3.8-flash' } },
			notesFolder: 'Notes/Study',
			topics: ['Cafe', 'Sleep'],
		});

		assert.equal(settings.analysisProvider, 'gemini');
		assert.equal(settings.transcriptionProvider, 'gemini');
		assert.equal(settings.providers.gemini.apiKey, 'key-123');
		assert.equal(settings.providers.gemini.analysisModel, 'gemini-3.8-flash');
		assert.equal(settings.notesFolder, 'Notes/Study');
		assert.deepEqual(settings.topics, ['Cafe', 'Sleep']);
	});

	it('repairs unknown providers and missing fields', () => {
		const settings = normalizeSettings({
			analysisProvider: 'not-a-provider',
			transcriptionProvider: 'anthropic',
			providers: { openai: { apiKey: 42 } },
		});

		assert.equal(settings.analysisProvider, 'openai');
		assert.equal(settings.transcriptionProvider, 'openai');
		assert.equal(settings.providers.openai.apiKey, '');
		assert.equal(settings.providers.openai.analysisModel, DEFAULT_SETTINGS.providers.openai.analysisModel);
	});
});

describe('describeMissingCredentials', () => {
	it('reports nothing when both keys are present', () => {
		const settings = normalizeSettings({
			providers: { openai: { apiKey: 'sk-1' } },
		});
		assert.deepEqual(describeMissingCredentials(settings), []);
	});

	it('reports the analysis key and the transcription key', () => {
		const settings = normalizeSettings({ providers: { openai: { apiKey: '' } } });
		const missing = describeMissingCredentials(settings);
		assert.equal(missing.length, 2);
		assert.match(missing[0]?.message ?? '', /openai/);
		assert.match(missing[1]?.message ?? '', /transcription/);
	});

	it('accepts an Anthropic analysis with a Gemini transcription', () => {
		const settings = normalizeSettings({
			analysisProvider: 'anthropic',
			transcriptionProvider: 'gemini',
			providers: { anthropic: { apiKey: 'a' }, gemini: { apiKey: 'g' } },
		});
		assert.deepEqual(describeMissingCredentials(settings), []);
	});
});
