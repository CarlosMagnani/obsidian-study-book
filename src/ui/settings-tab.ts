/**
 * Settings screen.
 *
 * Everything the user can change lives here: the BYOK keys, the models, the
 * download tool and the note preferences.
 */

import { Notice, PluginSettingTab, Setting, type App } from 'obsidian';

import { requestText } from '../core/http.ts';
import {
	PROVIDER_IDS,
	TRANSCRIPTION_PROVIDER_IDS,
	type ProviderId,
	type StudyBookSettings,
} from '../core/settings.ts';
import { getProvider } from '../providers/index.ts';
import type StudyBookPlugin from '../main.ts';

const BROWSERS = ['', 'chrome', 'chromium', 'firefox', 'edge', 'brave', 'vivaldi', 'opera', 'safari'];

export class StudyBookSettingsTab extends PluginSettingTab {
	private readonly study: StudyBookPlugin;

	constructor(app: App, plugin: StudyBookPlugin) {
		super(app, plugin);
		this.study = plugin;
	}

	private get settings(): StudyBookSettings {
		return this.study.settings;
	}

	private async save(): Promise<void> {
		await this.study.saveSettings();
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderProviderSection(containerEl);
		this.renderDownloadSection(containerEl);
		this.renderNoteSection(containerEl);
	}

	private renderProviderSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('BYOK providers').setHeading();

		new Setting(containerEl)
			.setName('Analysis provider')
			.setDesc('The model that writes the study notes.')
			.addDropdown((dropdown) => {
				for (const id of PROVIDER_IDS) {
					dropdown.addOption(id, getProvider(id).label);
				}
				dropdown.setValue(this.settings.analysisProvider);
				dropdown.onChange(async (value) => {
					this.settings.analysisProvider = value as ProviderId;
					await this.save();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName('Transcription provider')
			.setDesc(
				'Anthropic has no speech to text endpoint, so transcription always uses OpenAI or Gemini.',
			)
			.addDropdown((dropdown) => {
				for (const id of TRANSCRIPTION_PROVIDER_IDS) {
					dropdown.addOption(id, getProvider(id).label);
				}
				dropdown.setValue(this.settings.transcriptionProvider);
				dropdown.onChange(async (value) => {
					this.settings.transcriptionProvider = value as 'openai' | 'gemini';
					await this.save();
					this.display();
				});
			});

		for (const id of PROVIDER_IDS) {
			this.renderProviderSettings(containerEl, id);
		}
	}

	private renderProviderSettings(containerEl: HTMLElement, id: ProviderId): void {
		const provider = getProvider(id);
		const config = this.settings.providers[id];

		new Setting(containerEl).setName(provider.label).setHeading();

		new Setting(containerEl)
			.setName(`${provider.label} API key`)
			.setDesc('Stored in this vault only, and sent only to the provider you choose.')
			.addText((text) => {
				text.inputEl.type = 'password';
				text.setPlaceholder('sk-...');
				text.setValue(config.apiKey);
				text.onChange(async (value) => {
					config.apiKey = value.trim();
					await this.save();
				});
			});

		new Setting(containerEl)
			.setName('Analysis model')
			.setDesc(`Suggestions: ${provider.analysisModelSuggestions.join(', ')}`)
			.addText((text) => {
				text.setValue(config.analysisModel);
				text.onChange(async (value) => {
					config.analysisModel = value.trim();
					await this.save();
				});
			})
			.addButton((button) =>
				button
					.setButtonText('List models')
					.setCta()
					.onClick(async () => {
						await this.listModels(id);
					}),
			);

		if (provider.canTranscribe) {
			new Setting(containerEl)
				.setName('Transcription model')
				.setDesc(`Suggestions: ${provider.transcriptionModelSuggestions.join(', ')}`)
				.addText((text) => {
					text.setValue(config.transcriptionModel);
					text.onChange(async (value) => {
						config.transcriptionModel = value.trim();
						await this.save();
					});
				});
		}

		new Setting(containerEl)
			.setName('Base URL')
			.setDesc('Change it to use a proxy or a compatible gateway.')
			.addText((text) => {
				text.setValue(config.baseUrl);
				text.onChange(async (value) => {
					config.baseUrl = value.trim();
					await this.save();
				});
			})
			.addButton((button) =>
				button.setButtonText('Test connection').onClick(async () => {
					await this.testConnection(id);
				}),
			);
	}

	private async testConnection(id: ProviderId): Promise<void> {
		const config = this.settings.providers[id];
		if (!config.apiKey.trim()) {
			new Notice(`${id}: no API key configured`);
			return;
		}
		const url = `${config.baseUrl.replace(/\/+$/, '')}/models`;
		const headers: Record<string, string> =
			id === 'anthropic'
				? { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }
				: id === 'gemini'
					? { 'x-goog-api-key': config.apiKey }
					: { Authorization: `Bearer ${config.apiKey}` };
		try {
			await requestText(url, { method: 'GET', headers }, { retries: 0, timeoutMs: 20_000 });
			new Notice(`${id}: connection ok`);
		} catch (error) {
			new Notice(`${id}: ${(error as Error).message}`);
		}
	}

	private async listModels(id: ProviderId): Promise<void> {
		const config = this.settings.providers[id];
		if (!config.apiKey.trim()) {
			new Notice(`${id}: no API key configured`);
			return;
		}
		const url = `${config.baseUrl.replace(/\/+$/, '')}/models`;
		const headers: Record<string, string> =
			id === 'anthropic'
				? { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }
				: id === 'gemini'
					? { 'x-goog-api-key': config.apiKey }
					: { Authorization: `Bearer ${config.apiKey}` };
		try {
			const body = await requestText(
				url,
				{ method: 'GET', headers },
				{ retries: 0, timeoutMs: 20_000 },
			);
			const parsed = JSON.parse(body) as {
				data?: { id?: string; name?: string }[];
				models?: { id?: string; name?: string }[];
			};
			const names = (parsed.data ?? parsed.models ?? [])
				.map((entry) => entry.id ?? entry.name ?? '')
				.filter((entry) => entry.length > 0);
			if (names.length === 0) {
				new Notice(`${id}: the provider returned no model list`);
				return;
			}
			new Notice(`${id}: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ', …' : ''}`, 12000);
		} catch (error) {
			new Notice(`${id}: ${(error as Error).message}`);
		}
	}

	private renderDownloadSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Download').setHeading();

		new Setting(containerEl)
			.setName('yt-dlp path')
			.setDesc('Leave empty to use the yt-dlp found on the PATH.')
			.addText((text) => {
				text.setPlaceholder('yt-dlp');
				text.setValue(this.settings.ytDlpPath);
				text.onChange(async (value) => {
					this.settings.ytDlpPath = value.trim();
					await this.save();
				});
			})
			.addButton((button) =>
				button.setButtonText('Detect').onClick(async () => {
					const found = await this.study.detectYtDlp();
					new Notice(found ? `Found yt-dlp: ${found}` : 'yt-dlp was not found on the PATH');
				}),
			);

		new Setting(containerEl)
			.setName('Cookies from browser')
			.setDesc('Some Instagram posts need the cookies of a logged in browser.')
			.addDropdown((dropdown) => {
				for (const browser of BROWSERS) {
					dropdown.addOption(browser, browser || 'none');
				}
				dropdown.setValue(this.settings.cookiesFromBrowser);
				dropdown.onChange(async (value) => {
					this.settings.cookiesFromBrowser = value;
					await this.save();
				});
			});

		new Setting(containerEl)
			.setName('Cookie file')
			.setDesc('Optional Netscape cookie file, used when no browser is selected.')
			.addText((text) => {
				text.setValue(this.settings.cookieFile);
				text.onChange(async (value) => {
					this.settings.cookieFile = value.trim();
					await this.save();
				});
			});
	}

	private renderNoteSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Notes').setHeading();

		new Setting(containerEl)
			.setName('Notes folder')
			.setDesc('Folder inside the vault where the notes are created.')
			.addText((text) => {
				text.setValue(this.settings.notesFolder);
				text.onChange(async (value) => {
					this.settings.notesFolder = value.trim();
					await this.save();
				});
			});

		new Setting(containerEl)
			.setName('Temporary folder')
			.setDesc('Folder that receives the downloaded audio during the run.')
			.addText((text) => {
				text.setValue(this.settings.workFolder);
				text.onChange(async (value) => {
					this.settings.workFolder = value.trim();
					await this.save();
				});
			});

		new Setting(containerEl)
			.setName('Language of the notes')
			.setDesc('Example: "same as the source", "pt-BR" or "en".')
			.addText((text) => {
				text.setValue(this.settings.outputLanguage);
				text.onChange(async (value) => {
					this.settings.outputLanguage = value.trim();
					await this.save();
				});
			});

		new Setting(containerEl)
			.setName('Allowed topics')
			.setDesc('One topic per line. The model must choose one of them.')
			.addTextArea((text) => {
				text.setValue(this.settings.topics.join('\n'));
				text.onChange(async (value) => {
					this.settings.topics = value
						.split('\n')
						.map((topic) => topic.trim())
						.filter((topic) => topic.length > 0);
					await this.save();
				});
			});

		new Setting(containerEl)
			.setName('Include the transcript')
			.setDesc('Appends the full transcript inside a collapsed block.')
			.addToggle((toggle) => {
				toggle.setValue(this.settings.includeTranscript);
				toggle.onChange(async (value) => {
					this.settings.includeTranscript = value;
					await this.save();
				});
			});

		new Setting(containerEl)
			.setName('Keep the audio file')
			.setDesc('Keeps the downloaded audio in the temporary folder after the run.')
			.addToggle((toggle) => {
				toggle.setValue(this.settings.keepAudio);
				toggle.onChange(async (value) => {
					this.settings.keepAudio = value;
					await this.save();
				});
			});
	}
}
