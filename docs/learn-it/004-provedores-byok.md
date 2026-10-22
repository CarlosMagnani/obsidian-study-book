# Passo 4 — Provedores BYOK

## Contexto e comportamento esperado

Um "provedor" sabe falar com uma API. O resto do plugin só conhece a
interface `Provider`, então adicionar uma quarta API é escrever um arquivo
novo e registrá-lo.

Três provedores neste passo:

| Provedor | Transcreve | Analisa | Como exige JSON |
| --- | --- | --- | --- |
| OpenAI | sim | sim | `response_format: json_schema` (modo estrito) |
| Anthropic | não | sim | tool `save_analysis` com `input_schema` |
| Gemini | sim | sim | `generationConfig.responseSchema` |

As três APIs pedem o JSON de um jeito diferente. O ponto de convergência é
sempre o contrato `Analysis`.

## `src/providers/types.ts`

```ts
export interface Provider {
	id: ProviderId;
	label: string;
	canTranscribe: boolean;
	canAnalyze: boolean;
	analysisModelSuggestions: string[];
	transcriptionModelSuggestions: string[];
	transcribe(input: TranscribeInput, context: ProviderContext): Promise<Transcript>;
	analyze(input: AnalyzeInput, context: ProviderContext): Promise<Analysis>;
}
```

A interface descreve o que todo provedor precisa fazer. `canTranscribe`
existe porque a Anthropic não transcreve: o plugin usa esse campo para
esconder a opção e para explicar o motivo.

### Os timestamps do Gemini

```ts
export function parseTimestampedText(text: string): TranscriptSegment[] {
	const pattern = /\[(\d{1,2}):(\d{2})\]/g;
	const segments: TranscriptSegment[] = [];
	let lastIndex = 0;
	let lastStart: number | null = null;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text)) !== null) {
		const start = Number(match[1]) * 60 + Number(match[2]);
		const chunk = text.slice(lastIndex, match.index).trim();
		if (chunk) {
			segments.push({ start: lastStart ?? 0, end: start, text: chunk });
		}
		lastStart = start;
		lastIndex = match.index + match[0].length;
	}
	...
}
```

- A expressão regular `\[(\d{1,2}):(\d{2})\]` procura os marcadores
  `[mm:ss]`. O `g` faz a busca continuar depois do primeiro achado.
- `pattern.exec(text)` devolve o próximo achado ou `null`. O `while`
  termina quando não há mais nenhum.
- `match[1]` e `match[2]` são os grupos capturados: os minutos e os
  segundos.
- `text.slice(lastIndex, match.index)` corta o texto entre dois
  marcadores, que é o conteúdo daquele trecho.
- `lastStart ?? 0` usa o valor anterior quando ele existe e `0` quando não.

O prompt de transcrição do Gemini pede esses marcadores, e a função os
transforma no mesmo contrato que a OpenAI devolve nativamente.

## `src/providers/openai.ts`

### O envio do áudio

```ts
function buildAudioForm(input: TranscribeInput, model: string, responseFormat: string): FormData {
	const form = new FormData();
	const blob = new Blob([input.audioBytes as unknown as BlobPart], { type: input.mimeType });
	form.append('file', blob, input.fileName);
	form.append('model', model);
	form.append('response_format', responseFormat);
	return form;
}
```

A transcrição é um envio de arquivo, então o corpo é `multipart/form-data`
e não JSON. `FormData` e `Blob` existem no Electron e no Node, então o
mesmo código funciona no plugin e nos testes.

### O plano B

```ts
try {
	const body = await requestText(url, { ...init, body: buildAudioForm(input, context.model, 'verbose_json') }, { fetchImpl: context.fetchImpl });
	payload = JSON.parse(body);
} catch (error) {
	if (!(error instanceof HttpError) || error.status !== 400) {
		throw error;
	}
	const body = await requestText(url, { ...init, body: buildAudioForm(input, context.model, 'json') }, { fetchImpl: context.fetchImpl });
	payload = JSON.parse(body);
}
```

Nem todo modelo de transcrição aceita o formato `verbose_json`, que é o
único que devolve os segmentos com tempo. Quando a API recusa com 400, o
plugin repete a chamada no formato simples e perde só os timestamps. Qualquer
outro erro (401, 429, 500) é repassado sem segunda tentativa.

### A análise

```ts
body: JSON.stringify({
	model: context.model,
	messages: [{ role: 'user', content: prompt }],
	response_format: {
		type: 'json_schema',
		json_schema: { name: 'study_analysis', strict: true, schema: ANALYSIS_JSON_SCHEMA },
	},
}),
```

`response_format` com `strict: true` faz a OpenAI garantir que a resposta
cumpra o schema. A resposta vem em
`choices[0].message.content`, como texto JSON, e passa pelo
`parseAnalysis`.

## `src/providers/anthropic.ts`

```ts
tools: [
	{
		name: TOOL_NAME,
		description: 'Save the study notes extracted from the transcript.',
		input_schema: ANALYSIS_JSON_SCHEMA,
	},
],
tool_choice: { type: 'tool', name: TOOL_NAME },
```

A API da Anthropic não tem `response_format`. A forma suportada de obrigar
um JSON é descrever uma ferramenta: o modelo responde chamando a ferramenta,
e o conteúdo vem em `content[].input`, onde `type` é `tool_use`.

```ts
const toolUse = (body.content ?? []).find(
	(block) => block.type === 'tool_use' && block.name === TOOL_NAME,
);
```

`Array.find` devolve o primeiro elemento que satisfaz a condição, ou
`undefined`. O `?? []` protege o caso em que a resposta não tem `content`.

## `src/providers/gemini.ts`

### O schema sem `additionalProperties`

```ts
function geminiSchema(): Record<string, unknown> {
	const schema = JSON.parse(JSON.stringify(ANALYSIS_JSON_SCHEMA)) as Record<string, unknown>;
	delete schema.additionalProperties;
	...
	return schema;
}
```

O Gemini recusa a palavra `additionalProperties` no schema. A cópia é
feita com `JSON.parse(JSON.stringify(...))` para não alterar o schema
original, que é compartilhado com a OpenAI.

### O áudio embutido

```ts
contents: [
	{
		parts: [
			{ inline_data: { mime_type: input.mimeType, data: toBase64(input.audioBytes) } },
			{ text: buildTranscriptionPrompt(input.language) },
		],
	},
],
```

O Gemini é multimodal: o áudio entra como base64 no corpo da requisição,
junto com o texto que pede a transcrição. Não existe campo separado para
áudio na API de geração de texto.

### A análise

```ts
generationConfig: {
	responseMimeType: 'application/json',
	responseSchema: geminiSchema(),
},
```

`responseMimeType` avisa que a resposta é JSON e `responseSchema` diz o
formato. A resposta vem em
`candidates[0].content.parts[0].text`.

## `src/providers/index.ts`

```ts
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
```

`Record<ProviderId, Provider>` obriga o compilador a exigir os três
provedores: esquecer um é erro de tipo, não erro em produção.

## Verificação

`tests/providers.test.ts` usa um `fetch` falso e confere o que foi
enviado: URL, cabeçalhos, corpo da requisição e o resultado devolvido.
Cobre também o plano B do formato `verbose_json`, a recusa da Anthropic em
transcrever e a conversão dos marcadores de tempo do Gemini.
