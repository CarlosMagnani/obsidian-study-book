/**
 * Study Book: turn a video URL into a study note inside the vault.
 *
 * The plugin never owns an API key of its own. Every call uses the key the
 * user configured (BYOK), and the key never leaves this machine except for
 * the request to the chosen provider.
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { Notice, Plugin, normalizePath } from 'obsidian';

import {
	DEFAULT_SETTINGS,
	describeMissingCredentials,
	normalizeSettings,
	type StudyBookSettings,
} from './core/settings.ts';
import { findYtDlp } from './pipeline/download.ts';
import { analyzeTranscript } from './pipeline/analyze.ts';
import { noteFileName, renderNote } from './pipeline/note.ts';
import { providerContext, runPipeline } from './pipeline/run.ts';
import { getProvider } from './providers/index.ts';
import type { Transcript } from './providers/types.ts';
import { TranscriptModal, UrlModal } from './ui/modal.ts';
import { StudyBookSettingsTab } from './ui/settings-tab.ts';
import { createNote, ensureFolder } from './vault.ts';

export default class StudyBookPlugin extends Plugin {
	override settings: StudyBookSettings = structuredClone(DEFAULT_SETTINGS);

	override async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon('book-open-text', 'Study Book', () => {
			void this.promptForUrl();
		});

		this.addCommand({
			id: 'create-note-from-url',
			name: 'Create a study note from a video URL',
			callback: () => {
				void this.promptForUrl();
			},
		});

		this.addCommand({
			id: 'analyze-transcript',
			name: 'Analyze a transcript that you already have',
			callback: () => {
				void this.promptForTranscript();
			},
		});

		this.addCommand({
			id: 'check-setup',
			name: 'Check the setup',
			callback: () => {
				void this.checkSetup();
			},
		});

		this.addSettingTab(new StudyBookSettingsTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Returns the absolute path of the vault on disk.
	 */
	private vaultPath(): string {
		const adapter = this.app.vault.adapter as unknown as { basePath?: string };
		return adapter.basePath ?? this.app.vault.getRoot().path;
	}

	/**
	 * Looks for yt-dlp and reports the result.
	 */
	async detectYtDlp(): Promise<string | null> {
		try {
			return await findYtDlp(this.settings.ytDlpPath);
		} catch {
			return null;
		}
	}

	private promptForUrl(): void {
		new UrlModal(this.app, (url) => {
			void this.runFromUrl(url);
		}).open();
	}

	private promptForTranscript(): void {
		new TranscriptModal(this.app, (title, transcript) => {
			void this.runFromTranscript(title, transcript);
		}).open();
	}

	/**
	 * Reports what is missing before a run starts.
	 */
	private missingCredentials(): string[] {
		return describeMissingCredentials(this.settings).map((item) => item.message);
	}

	private async runFromUrl(url: string): Promise<void> {
		const missing = this.missingCredentials();
		if (missing.length > 0) {
			new Notice(`Study Book: ${missing.join('; ')}. Open the plugin settings.`, 8000);
			return;
		}

		const progress = new Notice('Study Book: starting…', 0);
		const workDir = path.join(this.vaultPath(), this.settings.workFolder.trim() || '.study-book');
		await mkdir(workDir, { recursive: true });

		try {
			const result = await runPipeline({
				url,
				settings: this.settings,
				workDir,
				onProgress: (message) => progress.setMessage(`Study Book: ${message}`),
			});
			const notePath = await this.saveNote(result.noteFileName, result.noteContent);
			progress.hide();
			new Notice(`Study Book: note created at ${notePath}`);
			await this.app.workspace.getLeaf(false).openFile(
				this.app.vault.getAbstractFileByPath(notePath) as never,
			);
		} catch (error) {
			progress.hide();
			new Notice(`Study Book: ${(error as Error).message}`, 12000);
		}
	}

	private async runFromTranscript(title: string, transcriptText: string): Promise<void> {
		const missing = this.missingCredentials().filter((message) => !message.includes('transcription'));
		if (missing.length > 0) {
			new Notice(`Study Book: ${missing.join('; ')}. Open the plugin settings.`, 8000);
			return;
		}

		const progress = new Notice('Study Book: analyzing the transcript…', 0);
		const transcript: Transcript = {
			sourceId: 'pasted',
			language: 'unknown',
			text: transcriptText,
			segments: [],
		};

		try {
			const provider = getProvider(this.settings.analysisProvider);
			const analysis = await analyzeTranscript(transcript, {
				provider,
				context: providerContext(this.settings, this.settings.analysisProvider, 'analysis'),
				title: title || 'Pasted transcript',
				url: '',
				language: this.settings.outputLanguage,
				topics: this.settings.topics,
			});
			const noteTitle = title || analysis.topic;
			const content = renderNote({
				title: noteTitle,
				url: '',
				videoId: 'pasted',
				analysis,
				transcript,
				provider: this.settings.analysisProvider,
				model: this.settings.providers[this.settings.analysisProvider].analysisModel,
				createdAt: new Date(),
				includeTranscript: this.settings.includeTranscript,
			});
			const notePath = await this.saveNote(noteFileName(noteTitle, 'pasted'), content);
			progress.hide();
			new Notice(`Study Book: note created at ${notePath}`);
			await this.app.workspace.getLeaf(false).openFile(
				this.app.vault.getAbstractFileByPath(notePath) as never,
			);
		} catch (error) {
			progress.hide();
			new Notice(`Study Book: ${(error as Error).message}`, 12000);
		}
	}

	/**
	 * Writes the note inside the configured folder.
	 */
	private async saveNote(fileName: string, content: string): Promise<string> {
		const folder = normalizePath(this.settings.notesFolder.trim());
		if (folder) {
			await ensureFolder(this.app.vault, folder);
		}
		return createNote(this.app.vault, folder, fileName, content);
	}

	/**
	 * Command that tells the user what works and what does not.
	 */
	private async checkSetup(): Promise<void> {
		const lines: string[] = [];
		const ytDlp = await this.detectYtDlp();
		lines.push(ytDlp ? `yt-dlp: found (${ytDlp})` : 'yt-dlp: not found');
		const missing = this.missingCredentials();
		lines.push(
			missing.length === 0
				? 'API keys: configured'
				: `API keys: ${missing.join('; ')}`,
		);
		new Notice(`Study Book\n${lines.join('\n')}`, 12000);
	}
}
