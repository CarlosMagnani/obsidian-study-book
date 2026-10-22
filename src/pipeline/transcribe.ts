/**
 * Transcription stage: audio file to transcript, through the BYOK provider.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Provider, ProviderContext, Transcript } from '../providers/types.ts';

const MIME_TYPES: Record<string, string> = {
	'.m4a': 'audio/mp4',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.webm': 'audio/webm',
	'.ogg': 'audio/ogg',
	'.opus': 'audio/opus',
	'.flac': 'audio/flac',
	'.aac': 'audio/aac',
	'.mp4': 'audio/mp4',
};

export function mimeTypeFor(filePath: string): string {
	const extension = path.extname(filePath).toLowerCase();
	return MIME_TYPES[extension] ?? 'application/octet-stream';
}

export interface TranscribeOptions {
	provider: Provider;
	context: ProviderContext;
	sourceId: string;
	language?: string;
}

/**
 * Reads the audio from disk and asks the provider to transcribe it.
 */
export async function transcribeAudio(
	audioPath: string,
	options: TranscribeOptions,
): Promise<Transcript> {
	if (!options.provider.canTranscribe) {
		throw new Error(`${options.provider.label} does not transcribe audio`);
	}
	const bytes = await readFile(audioPath);
	return options.provider.transcribe(
		{
			audioPath,
			audioBytes: new Uint8Array(bytes),
			mimeType: mimeTypeFor(audioPath),
			fileName: path.basename(audioPath),
			sourceId: options.sourceId,
			language: options.language ?? '',
		},
		options.context,
	);
}
