/**
 * Small HTTP layer shared by every provider.
 *
 * The `fetch` implementation is injectable so the tests can answer with
 * canned payloads without touching the network.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
	readonly status: number;
	readonly body: string;
	readonly retryAfter: string | null;

	constructor(status: number, body: string, message?: string, retryAfter: string | null = null) {
		super(message ?? `request failed with status ${status}`);
		this.name = 'HttpError';
		this.status = status;
		this.body = body;
		this.retryAfter = retryAfter;
	}
}

export interface RequestOptions {
	fetchImpl?: FetchLike;
	timeoutMs?: number;
	retries?: number;
	sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_RETRIES = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt: number, retryAfter?: string | null): number {
	if (retryAfter) {
		const seconds = Number(retryAfter);
		if (Number.isFinite(seconds) && seconds >= 0) {
			return Math.min(seconds * 1000, 30_000);
		}
	}
	return Math.min(1000 * 2 ** attempt, 30_000);
}

function isRetryable(status: number): boolean {
	return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

/**
 * Performs a request and returns the raw body.
 *
 * Retries only what is worth retrying: rate limits and server errors. A 401
 * or 400 fails immediately, because retrying a wrong key only wastes money.
 */
export async function requestText(
	url: string,
	init: RequestInit,
	options: RequestOptions = {},
): Promise<string> {
	const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
	if (!fetchImpl) {
		throw new Error('no fetch implementation available');
	}
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const retries = options.retries ?? DEFAULT_RETRIES;
	const sleep = options.sleep ?? defaultSleep;

	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetchImpl(url, { ...init, signal: controller.signal });
			const body = await response.text();
			if (!response.ok) {
				throw new HttpError(
					response.status,
					body,
					describeError(response.status, body),
					response.headers?.get?.('retry-after') ?? null,
				);
			}
			return body;
		} catch (error) {
			lastError = error;
			const status = error instanceof HttpError ? error.status : 0;
			const aborted = error instanceof Error && error.name === 'AbortError';
			if (attempt >= retries || (!aborted && status > 0 && !isRetryable(status))) {
				throw error;
			}
			const retryAfter = error instanceof HttpError ? error.retryAfter : null;
			await sleep(retryDelay(attempt, retryAfter));
		} finally {
			clearTimeout(timer);
		}
	}
	throw lastError;
}

/**
 * Turns a provider error body into a message a human can act on.
 */
export function describeError(status: number, body: string): string {
	let detail = body.slice(0, 400);
	try {
		const parsed = JSON.parse(body) as Record<string, unknown>;
		const error = parsed.error;
		if (typeof error === 'string') {
			detail = error;
		} else if (isRecord(error) && typeof error.message === 'string') {
			detail = error.message;
		} else if (typeof parsed.message === 'string') {
			detail = parsed.message;
		}
	} catch {
		// The body is not JSON; the raw text is the best detail available.
	}
	if (status === 401 || status === 403) {
		return `authentication failed (${status}): ${detail}`;
	}
	if (status === 429) {
		return `rate limited (${status}): ${detail}`;
	}
	return `provider request failed (${status}): ${detail}`;
}

export async function requestJson<T>(
	url: string,
	init: RequestInit,
	options: RequestOptions = {},
): Promise<T> {
	const body = await requestText(url, init, options);
	try {
		return JSON.parse(body) as T;
	} catch {
		throw new Error(`provider returned a non JSON response: ${body.slice(0, 200)}`);
	}
}

/**
 * Encodes bytes as base64 without blowing the call stack on big files.
 */
export function toBase64(bytes: Uint8Array): string {
	const chunkSize = 0x8000;
	let binary = '';
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return btoa(binary);
}
