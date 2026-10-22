/**
 * Plugin settings: the BYOK configuration and the note preferences.
 *
 * Every provider key is stored by Obsidian inside the vault
 * (`.obsidian/plugins/study-book/data.json`). Nothing is sent anywhere except
 * to the provider the user chose.
 */

export type ProviderId = 'openai' | 'anthropic' | 'gemini';
export type TranscriptionProviderId = 'openai' | 'gemini';

export const PROVIDER_IDS: ProviderId[] = ['openai', 'anthropic', 'gemini'];
export const TRANSCRIPTION_PROVIDER_IDS: TranscriptionProviderId[] = ['openai', 'gemini'];

export interface ProviderConfig {
	apiKey: string;
	analysisModel: string;
	transcriptionModel: string;
	baseUrl: string;
}

export interface StudyBookSettings {
	analysisProvider: ProviderId;
	transcriptionProvider: TranscriptionProviderId;
	providers: Record<ProviderId, ProviderConfig>;
	notesFolder: string;
	outputLanguage: string;
	topics: string[];
	includeTranscript: boolean;
	keepAudio: boolean;
	ytDlpPath: string;
	cookiesFromBrowser: string;
	cookieFile: string;
	workFolder: string;
}

export const DEFAULT_SETTINGS: StudyBookSettings = {
	analysisProvider: 'openai',
	transcriptionProvider: 'openai',
	providers: {
		openai: {
			apiKey: '',
			analysisModel: 'gpt-5.6-luna',
			transcriptionModel: 'gpt-transcribe',
			baseUrl: 'https://api.openai.com/v1',
		},
		anthropic: {
			apiKey: '',
			analysisModel: 'claude-sonnet-5-5',
			transcriptionModel: '',
			baseUrl: 'https://api.anthropic.com/v1',
		},
		gemini: {
			apiKey: '',
			analysisModel: 'gemini-3.8-flash',
			transcriptionModel: 'gemini-3.8-flash',
			baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		},
	},
	notesFolder: 'Study Book',
	outputLanguage: 'same as the source',
	topics: [],
	includeTranscript: true,
	keepAudio: false,
	ytDlpPath: '',
	cookiesFromBrowser: '',
	cookieFile: '',
	workFolder: '.study-book',
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function asProviderId(value: unknown, fallback: ProviderId): ProviderId {
	return PROVIDER_IDS.includes(value as ProviderId) ? (value as ProviderId) : fallback;
}

function asTranscriptionProviderId(
	value: unknown,
	fallback: TranscriptionProviderId,
): TranscriptionProviderId {
	return TRANSCRIPTION_PROVIDER_IDS.includes(value as TranscriptionProviderId)
		? (value as TranscriptionProviderId)
		: fallback;
}

/**
 * Merges the stored settings with the defaults.
 *
 * Obsidian hands back whatever was saved, so a settings file written by an
 * older version (or by hand) must never crash the plugin.
 */
export function normalizeSettings(raw: unknown): StudyBookSettings {
	if (!isRecord(raw)) {
		return structuredClone(DEFAULT_SETTINGS);
	}
	const storedProviders = isRecord(raw.providers) ? raw.providers : {};
	const providers = {} as Record<ProviderId, ProviderConfig>;
	for (const id of PROVIDER_IDS) {
		const stored = isRecord(storedProviders[id]) ? storedProviders[id] : {};
		const fallback = DEFAULT_SETTINGS.providers[id];
		providers[id] = {
			apiKey: asString(stored.apiKey, fallback.apiKey),
			analysisModel: asString(stored.analysisModel, fallback.analysisModel),
			transcriptionModel: asString(stored.transcriptionModel, fallback.transcriptionModel),
			baseUrl: asString(stored.baseUrl, fallback.baseUrl),
		};
	}
	return {
		analysisProvider: asProviderId(raw.analysisProvider, DEFAULT_SETTINGS.analysisProvider),
		transcriptionProvider: asTranscriptionProviderId(
			raw.transcriptionProvider,
			DEFAULT_SETTINGS.transcriptionProvider,
		),
		providers,
		notesFolder: asString(raw.notesFolder, DEFAULT_SETTINGS.notesFolder),
		outputLanguage: asString(raw.outputLanguage, DEFAULT_SETTINGS.outputLanguage),
		topics: Array.isArray(raw.topics)
			? raw.topics.filter((topic): topic is string => typeof topic === 'string')
			: [],
		includeTranscript: asBoolean(raw.includeTranscript, DEFAULT_SETTINGS.includeTranscript),
		keepAudio: asBoolean(raw.keepAudio, DEFAULT_SETTINGS.keepAudio),
		ytDlpPath: asString(raw.ytDlpPath, DEFAULT_SETTINGS.ytDlpPath),
		cookiesFromBrowser: asString(raw.cookiesFromBrowser, DEFAULT_SETTINGS.cookiesFromBrowser),
		cookieFile: asString(raw.cookieFile, DEFAULT_SETTINGS.cookieFile),
		workFolder: asString(raw.workFolder, DEFAULT_SETTINGS.workFolder),
	};
}

/**
 * Explains what is still missing before a run can start.
 */
export function describeMissingCredentials(
	settings: StudyBookSettings,
): { provider: ProviderId | TranscriptionProviderId; message: string }[] {
	const missing: { provider: ProviderId | TranscriptionProviderId; message: string }[] = [];
	const analysis = settings.providers[settings.analysisProvider];
	if (!analysis.apiKey.trim()) {
		missing.push({
			provider: settings.analysisProvider,
			message: `no API key configured for ${settings.analysisProvider}`,
		});
	}
	const transcription = settings.providers[settings.transcriptionProvider];
	if (!transcription.apiKey.trim()) {
		missing.push({
			provider: settings.transcriptionProvider,
			message: `no API key configured for ${settings.transcriptionProvider} (transcription)`,
		});
	}
	return missing;
}
