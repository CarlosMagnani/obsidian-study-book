/**
 * Provider registry.
 */

import type { ProviderId } from '../core/settings.ts';
import { anthropicProvider } from './anthropic.ts';
import { geminiProvider } from './gemini.ts';
import { openaiProvider } from './openai.ts';
import type { Provider } from './types.ts';

export const PROVIDERS: Record<ProviderId, Provider> = {
	openai: openaiProvider,
	anthropic: anthropicProvider,
	gemini: geminiProvider,
};

export function getProvider(id: ProviderId): Provider {
	const provider = PROVIDERS[id];
	if (!provider) {
		throw new Error(`unknown provider: ${id}`);
	}
	return provider;
}

export { anthropicProvider, geminiProvider, openaiProvider };
export type { Provider };
