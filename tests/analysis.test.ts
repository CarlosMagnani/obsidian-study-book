import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AnalysisError, parseAnalysis } from '../src/core/analysis.ts';

describe('parseAnalysis', () => {
	it('accepts a complete payload', () => {
		const analysis = parseAnalysis({
			topic: 'Sleep',
			summary: 'The video explains how sleep cycles work.',
			key_points: ['Deep sleep happens early in the night.', 'REM sleep gets longer later.'],
			timestamps: [{ start: 12, end: 45, label: 'The first deep sleep block' }],
			language: 'en',
		});

		assert.equal(analysis.topic, 'Sleep');
		assert.equal(analysis.key_points.length, 2);
		assert.equal(analysis.timestamps[0]?.label, 'The first deep sleep block');
		assert.equal(analysis.language, 'en');
	});

	it('parses a JSON string', () => {
		const analysis = parseAnalysis(
			'{"topic":"Cafe","summary":"Sobre cafe.","key_points":[],"timestamps":[],"language":"pt"}',
		);
		assert.equal(analysis.topic, 'Cafe');
		assert.equal(analysis.language, 'pt');
	});

	it('fills the optional fields when they are missing', () => {
		const analysis = parseAnalysis({ topic: 'Cafe', summary: 'Sobre cafe.' });
		assert.deepEqual(analysis.key_points, []);
		assert.deepEqual(analysis.timestamps, []);
		assert.equal(analysis.language, 'unknown');
	});

	it('rejects a payload without topic or summary', () => {
		assert.throws(() => parseAnalysis({ summary: 'only the summary' }), AnalysisError);
	});

	it('rejects a payload that is not JSON', () => {
		assert.throws(() => parseAnalysis('not json at all'), AnalysisError);
	});

	it('ignores key points that are not strings', () => {
		const analysis = parseAnalysis({
			topic: 'Cafe',
			summary: 'Sobre cafe.',
			key_points: ['valid', 42, null],
		});
		assert.deepEqual(analysis.key_points, ['valid']);
	});
});
