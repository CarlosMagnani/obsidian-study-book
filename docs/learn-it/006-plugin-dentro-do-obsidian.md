# Passo 6 — O plugin dentro do Obsidian

## Contexto e comportamento esperado

Até aqui o plugin era TypeScript puro. Este passo conecta tudo à API do
Obsidian:

- `src/main.ts` — a classe do plugin, os comandos e o ícone da barra;
- `src/ui/modal.ts` — os dois modais (URL e transcript colado);
- `src/ui/settings-tab.ts` — a tela de configurações.

Só estes três arquivos importam `obsidian`.

## `src/main.ts`

### A classe

```ts
export default class StudyBookPlugin extends Plugin {
	override settings: StudyBookSettings = structuredClone(DEFAULT_SETTINGS);

	override async onload(): Promise<void> {
		await this.loadSettings();
		...
	}
}
```

- `extends Plugin` é a herança: a classe ganha os métodos `addCommand`,
  `addRibbonIcon`, `addSettingTab`, `loadData` e `saveData`.
- `export default` é o que o Obsidian procura no `main.js`.
- `override` é obrigatório quando o método existe na classe base. O
  TypeScript exige isso quando `"noImplicitOverride": true` está ligado.
  Como `Plugin` já declara `settings` (desde o Obsidian 1.13), a
  propriedade também precisa do `override`.
- `onload` roda quando o plugin é carregado. `onunload` não é necessário
  porque nada precisa ser limpo.

### Os comandos

```ts
this.addCommand({
	id: 'create-note-from-url',
	name: 'Create a study note from a video URL',
	callback: () => {
		void this.promptForUrl();
	},
});
```

`addCommand` registra um comando na paleta. O `callback` é chamado quando
o comando é escolhido. O `void` na frente explica ao compilador que a
promessa retornada é intencionalmente ignorada: `promptForUrl` é
assíncrono, mas o callback do Obsidian não espera promise.

### O ícone da barra

```ts
this.addRibbonIcon('book-open-text', 'Study Book', () => {
	void this.promptForUrl();
});
```

O primeiro argumento é o nome de um ícone do Lucide que já existe dentro
do aplicativo, o segundo é o texto que aparece ao passar o mouse.

### O caminho do cofre

```ts
private vaultPath(): string {
	const adapter = this.app.vault.adapter as unknown as { basePath?: string };
	return adapter.basePath ?? this.app.vault.getRoot().path;
}
```

`app.vault.getRoot().path` é um caminho **virtual** do Obsidian, que não
serve para o sistema de arquivos. O `adapter.basePath` é o caminho real
da pasta do cofre no disco, e existe apenas no aplicativo de desktop.
Por isso o plugin declara `isDesktopOnly: true`.

### O progresso

```ts
const progress = new Notice('Study Book: starting…', 0);
...
progress.setMessage(`Study Book: ${message}`);
...
progress.hide();
```

Um `Notice` com duração `0` fica na tela até ser escondido. Cada etapa do
pipeline atualiza a mesma notificação, em vez de criar várias.

### O tratamento de erro

```ts
} catch (error) {
	progress.hide();
	new Notice(`Study Book: ${(error as Error).message}`, 12000);
}
```

A mensagem do erro vai para o usuário, porque é ela que diz o que fazer
(por exemplo, `authentication failed (401)`). A notificação de erro fica
12 segundos na tela.

### A verificação de credenciais

```ts
private missingCredentials(): string[] {
	return describeMissingCredentials(this.settings).map((item) => item.message);
}
```

O plugin pergunta ao módulo de configurações o que falta e mostra uma
única mensagem com todos os problemas. Rodar sem chave só produziria um
erro de autenticação confuso.

## `src/ui/modal.ts`

```ts
export class UrlModal extends Modal {
	private value = '';

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Study Book' });
		...
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
```

- `extends Modal` dá o comportamiento de janela sobre o aplicativo.
- `contentEl.empty()` limpa o conteúdo: sem isso, abrir o modal duas vezes
  duplicaria o formulário.
- `onOpen` e `onClose` existem na classe base, por isso precisam de
  `override`.

```ts
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
```

`Setting` é o construtor de linhas de configuração do Obsidian. O
`addText` recebe um callback com o campo de texto; `onChange` roda a cada
digitação. `setTimeout` com 50 milissegundos espera o modal terminar de
aparecer antes de colocar o cursor no campo.

O segundo modal (`TranscriptModal`) é igual, com uma área de texto no
lugar do campo de URL. Ele atende quem já tem a transcrição e não quer
baixar nada.

## `src/ui/settings-tab.ts`

### A classe

```ts
export class StudyBookSettingsTab extends PluginSettingTab {
	private readonly study: StudyBookPlugin;

	constructor(app: App, plugin: StudyBookPlugin) {
		super(app, plugin);
		this.study = plugin;
	}
}
```

A classe base já tem uma propriedade `plugin`, então o plugin específico
é guardado em `study` para ter o tipo completo.

### As seções

```ts
override display(): void {
	const { containerEl } = this;
	containerEl.empty();
	this.renderProviderSection(containerEl);
	this.renderDownloadSection(containerEl);
	this.renderNoteSection(containerEl);
}
```

`display` é chamado pelo Obsidian quando a tela abre. `containerEl.empty()`
limpa o que havia antes: sem isso, toda abertura repetiria as linhas.

### Os provedores

```ts
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
```

- `addDropdown` recebe o construtor de opções; `addOption(valor, texto)`
  cadastra uma opção.
- `onChange` é assíncrono porque precisa gravar as configurações.
- `value as ProviderId` converte o texto da opção para o tipo esperado.
  O `as` é necessário porque o valor do dropdown é `string`.
- `this.display()` redesenha a tela depois da mudança: as linhas
  dependem do provedor escolhido (a Anthropic, por exemplo, não tem
  modelo de transcrição).

### A chave da API

```ts
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
```

`text.inputEl.type = 'password'` troca o campo por uma caixa de senha: os
caracteres aparecem como pontos.

### Testar a conexão

```ts
private async testConnection(id: ProviderId): Promise<void> {
	const config = this.settings.providers[id];
	if (!config.apiKey.trim()) {
		new Notice(`${id}: no API key configured`);
		return;
	}
	const url = `${config.baseUrl.replace(/\/+$/, '')}/models`;
	...
}
```

Cada provedor tem um endpoint `/models`. A chamada usa o cabeçalho
correto para cada um (`Authorization: Bearer`, `x-api-key` ou
`x-goog-api-key`) e o botão **List models** mostra os nomes reais,
tirados da API, em vez de uma lista fixa no código.

## Verificação

Esta etapa não tem teste unitário: `main.ts` e `src/ui/` dependem do
aplicativo. A verificação é manual, com o checklist do
[guia de publicação](../PUBLISHING.md): instalar o `main.js` no cofre de
testes, abrir as configurações e rodar o comando **Check the setup**.
