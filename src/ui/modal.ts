/**
 * The two modals used by the plugin: one for a video URL and one for a
 * transcript that the user already has.
 */

import { Modal, Setting, type App } from 'obsidian';

export class UrlModal extends Modal {
	private value = '';

	constructor(
		app: App,
		private readonly onSubmit: (url: string) => void,
	) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Study Book' });
		contentEl.createEl('p', {
			text: 'Paste the URL of a video. The plugin downloads the audio, transcribes it and writes the study notes in your vault.',
		});

		new Setting(contentEl).setName('Video URL').addText((text) => {
			text.setPlaceholder('https://www.instagram.com/reel/...');
			text.onChange((value) => {
				this.value = value.trim();
			});
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					this.submit();
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 50);
		});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Create note')
					.setCta()
					.onClick(() => this.submit()),
			)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()));
	}

	private submit(): void {
		if (!this.value) {
			return;
		}
		this.close();
		this.onSubmit(this.value);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}

export class TranscriptModal extends Modal {
	private transcript = '';
	private title = '';

	constructor(
		app: App,
		private readonly onSubmit: (title: string, transcript: string) => void,
	) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Study Book' });
		contentEl.createEl('p', {
			text: 'Paste a transcript you already have. The plugin writes the study notes without downloading anything.',
		});

		new Setting(contentEl).setName('Title').addText((text) => {
			text.setPlaceholder('Optional title');
			text.onChange((value) => {
				this.title = value.trim();
			});
		});

		new Setting(contentEl).setName('Transcript').addTextArea((text) => {
			text.setPlaceholder('Paste the transcript here');
			text.onChange((value) => {
				this.transcript = value;
			});
			window.setTimeout(() => text.inputEl.focus(), 50);
		});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Create note')
					.setCta()
					.onClick(() => this.submit()),
			)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()));
	}

	private submit(): void {
		if (!this.transcript.trim()) {
			return;
		}
		this.close();
		this.onSubmit(this.title, this.transcript.trim());
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
