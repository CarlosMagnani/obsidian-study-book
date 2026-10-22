# Passo 3 — Configurações e prompt

## Contexto e comportamento esperado

O plugin guarda tudo o que o usuário configura no `data.json`, dentro da
pasta do plugin no cofre. São duas coisas: **as chaves e os modelos** (a
parte BYOK) e **as preferências da nota** (pasta, idioma, tópicos).

`src/core/settings.ts` define esse formato, os valores padrão, a função
`normalizeSettings` (que conserta um arquivo de configuração velho ou
corrompido) e o diagnóstico `describeMissingCredentials`.

`src/core/prompt.ts` monta as instruções enviadas ao modelo. As duas
etapas de provider compartilham o mesmo prompt, então a nota tem sempre a
mesma cara, não importa de quem veio o texto.

## `src/core/settings.ts`

### Os tipos

```ts
export type ProviderId = 'openai' | 'anthropic' | 'gemini';
export type TranscriptionProviderId = 'openai' | 'gemini';
```

`type` com valores literais cria uma união: a variável só pode assumir um
dos três valores. `TranscriptionProviderId` não inclui `anthropic` porque a
API da Anthropic não transcreve áudio.

```ts
export interface ProviderConfig {
	apiKey: string;
	analysisModel: string;
	transcriptionModel: string;
	baseUrl: string;
}
```

Cada provedor tem os mesmos quatro campos. O `baseUrl` permite apontar
para um proxy ou um gateway compatível sem mexer no código.

### Os padrões

```ts
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
		...
	},
	...
};
```

A OpenAI é o padrão de análise e de transcrição, como pedido. As chaves
começam vazias: o plugin nunca embute uma credencial.

### Consertando uma configuração velha

```ts
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
			...
		};
	}
	...
}
```

- `structuredClone` copia o objeto padrão em profundidade. Sem isso, mudar
  uma configuração mudaria o padrão global para o resto do processo.
- `isRecord` (type guard) garante que a parte lida é um objeto.
- `asString(stored.apiKey, fallback.apiKey)` devolve o valor guardado
  quando ele é texto e o padrão quando não é.
- O laço `for (const id of PROVIDER_IDS)` reconstrói os três provedores,
  mesmo que o arquivo salvo tenha só um deles.

O ponto importante: um `data.json` escrito por uma versão antiga do plugin
nunca pode derrubar o aplicativo. A função sempre devolve um objeto
completo.

### O diagnóstico

```ts
export function describeMissingCredentials(settings: StudyBookSettings) {
	const missing = [];
	const analysis = settings.providers[settings.analysisProvider];
	if (!analysis.apiKey.trim()) {
		missing.push({ provider: settings.analysisProvider, message: `no API key configured for ${settings.analysisProvider}` });
	}
	...
}
```

A chave de análise e a de transcrição são verificadas separadamente, porque
elas podem ser de provedores diferentes. `String.trim()` remove espaços no
início e no fim: uma chave só com espaços não é uma chave.

## `src/core/prompt.ts`

```ts
export function buildAnalysisPrompt(input: PromptInput): string {
	const lines: string[] = [
		'You turn a video transcript into study material.',
		'',
		`Title: ${input.title || 'unknown'}`,
		`Source: ${input.url}`,
		'',
		'Write the notes in this language: ' + input.language + '.',
	];
	if (input.topics.length > 0) {
		lines.push(
			'',
			`Classify the topic using only these labels: ${input.topics.join(', ')}.`,
			'If none of them fits, use the closest one and mention the mismatch in the summary.',
		);
	}
	...
	return lines.join('\n');
}
```

- O array de linhas é montado e depois unido com `join('\n')`. É mais fácil
  de ler do que uma sequência de concatenações.
- `${input.title || 'unknown'}` é uma *template literal*. O `||` devolve o
  primeiro valor que não é vazio.
- `input.topics.join(', ')` transforma a lista de tópicos em um texto
  separado por vírgula.
- O prompt **não** descreve o formato da resposta. Quem define o formato é
  o `ANALYSIS_JSON_SCHEMA`, enviado junto com a requisição. Separar as duas
  coisas é o que permite trocar de provedor sem reescrever o prompt.

A lista de tópicos é a mesma ideia da taxonomia do projeto Python: quando
o usuário escreve os rótulos que ele usa no cofre, a nota respeita o
vocabulário dele.

## Verificação

`tests/settings.test.ts` cobre: nada salvo (volta os padrões), valores
salvos (são preservados) e configuração corrompida (é consertada). O
diagnóstico é testado nos três casos: as duas chaves presentes, a chave de
análise faltando e a combinação Anthropic com Gemini.
