/**
 * Helpers shared by the tests: a fake `fetch` and a fake `execFile`.
 */

import type { FetchLike } from '../../src/core/http.ts';

export interface RecordedRequest {
	url: string;
	init: RequestInit;
}

export interface FakeResponse {
	status?: number;
	body?: unknown;
	text?: string;
}

export interface FakeFetch {
	fetchImpl: FetchLike;
	requests: RecordedRequest[];
}

/**
 * Builds a `fetch` that answers with the canned responses, in order.
 */
export function fakeFetch(responses: FakeResponse[]): FakeFetch {
	const requests: RecordedRequest[] = [];
	let index = 0;
	const fetchImpl: FetchLike = async (url, init) => {
		requests.push({ url, init: init ?? {} });
		const response = responses[Math.min(index, responses.length - 1)];
		index += 1;
		if (!response) {
			throw new Error('the fake fetch ran out of canned responses');
		}
		const status = response.status ?? 200;
		const body = response.text ?? JSON.stringify(response.body ?? {});
		return new Response(body, {
			status,
			headers: { 'content-type': 'application/json' },
		});
	};
	return { fetchImpl, requests };
}

/**
 * Reads the JSON body of a recorded request.
 */
export function requestJson(request: RecordedRequest): Record<string, unknown> {
	const body = request.init.body;
	if (typeof body !== 'string') {
		throw new Error('the request body is not a JSON string');
	}
	return JSON.parse(body) as Record<string, unknown>;
}

/**
 * Reads the form data of a recorded request.
 */
export async function requestForm(request: RecordedRequest): Promise<FormData> {
	const body = request.init.body;
	if (!(body instanceof FormData)) {
		throw new Error('the request body is not a FormData');
	}
	return body;
}
