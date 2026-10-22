# Passo 5 — Pipeline: download, transcrição, análise e nota

## Contexto e comportamento esperado

O pipeline é a sequência que o usuário não vê: um vídeo vira uma nota. São
quatro arquivos:

- `src/pipeline/download.ts` — busca o áudio com o `yt-dlp`;
- `src/pipeline/transcribe.ts` — lê o áudio do disco e pede a transcrição;
- `src/pipeline/analyze.ts` — pede a análise;
- `src/pipeline/note.ts` — escreve o Markdown;
- `src/pipeline/run.ts` — costura tudo;
- `src/vault.ts` — cria a pasta e o arquivo no cofre.

Nenhum deles importa `obsidian`: o cofre é descrito por uma interface
pequena (`VaultLike`), e o resto do núcleo é TypeScript puro.

## `src/pipeline/download.ts`

### Encontrar o binário

```ts
export async function findYtDlp(configuredPath = '', run: typeof execFile = execFile): Promise<string> {
	const candidates = configuredPath.trim()
		? [configuredPath.trim()]
		: process.platform === 'win32'
			? ['yt-dlp.exe', 'yt-dlp']
			: ['yt-dlp'];

	for (const candidate of candidates) {
		try {
			await run(candidate, ['--version'], { timeout: 15_000 });
			return candidate;
		} catch {
			// Try the next candidate.
		}
	}
	throw new Error('yt-dlp was not found. ...');
}
```

- `configuredPath = ''` é um valor padrão: quando o argumento não é
  informado, a variável vale `''`.
- `process.platform === 'win32'` distingue o Windows. No Windows, o
  executável costuma ter a extensão `.exe`.
- O parâmetro `run` é o ponto de injeção: o teste passa um `execFile`
  falso e nenhum binário é executado.
- O `catch` sem variável (`catch {`) ignora o erro: o objetivo é apenas
  tentar o próximo candidato.

### Os argumentos do yt-dlp

```ts
const args = [
	'--no-playlist',
	'--no-warnings',
	'--no-simulate',
	'--extract-audio',
	'--audio-format', 'm4a',
	'--audio-quality', '0',
	'--write-info-json',
	'--print-json',
	'-f', 'bestaudio/best',
	'-o', path.join(options.workDir, '%(id)s.%(ext)s'),
];
```

- `--no-simulate` é essencial: `--print-json` implica simulação, e sem
  este parâmetro o arquivo nunca seria baixado.
- `--extract-audio` com `--audio-format m4a` converte o áudio.
- `%(id)s` e `%(ext)s` são variáveis do próprio yt-dlp: o nome do arquivo
  vira o identificador do vídeo mais a extensão.
- Os argumentos são um **vetor**, nunca uma string de shell. Isso
  impede que um caractere da URL seja interpretado como comando.

### A URL

```ts
function assertHttpsUrl(url: string): string {
	const trimmed = url.trim();
	if (!/^https:\/\//i.test(trimmed)) {
		throw new Error('the URL must start with https://');
	}
	return trimmed;
}
```

Só `https` é aceito. A URL vem do usuário, e a regra vale para qualquer
site, não só Instagram.

### A execução

```ts
function runPromise(run, command, args, timeout) {
	return new Promise((resolve, reject) => {
		run(command, args, { timeout, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
			if (error) {
				const detail = typeof stderr === 'string' ? stderr.trim() : '';
				reject(new Error(detail || (error as Error).message));
				return;
			}
			resolve({ stdout: String(stdout), stderr: String(stderr) });
		});
	});
}
```

`execFile` usa callbacks; essa função embrulha o callback em uma
`Promise`, que é a forma moderna de escrever o mesmo código. `maxBuffer`
aumenta o limite do texto capturado, porque o JSON do yt-dlp é grande.

## `src/pipeline/transcribe.ts`

```ts
export function mimeTypeFor(filePath: string): string {
	const extension = path.extname(filePath).toLowerCase();
	return MIME_TYPES[extension] ?? 'application/octet-stream';
}
```

Cada provedor precisa saber o tipo do áudio. O dicionário `MIME_TYPES`
mapeia a extensão para o tipo MIME. O `??` devolve o valor padrão quando a
extensão é desconhecida.

```ts
const bytes = await readFile(audioPath);
return options.provider.transcribe({
	audioPath,
	audioBytes: new Uint8Array(bytes),
	mimeType: mimeTypeFor(audioPath),
	fileName: path.basename(audioPath),
	sourceId: options.sourceId,
	language: options.language ?? '',
}, options.context);
```

`readFile` devolve um `Buffer` (bytes do Node). `new Uint8Array(bytes)`
converte para o tipo que o navegador entende, e o mesmo objeto serve
para o `Blob` do `FormData`.

## `src/pipeline/analyze.ts`

É uma função fina: monta o pedido e devolve o resultado do provedor. Ela
existe para que o `run.ts` não precise conhecer a assinatura do provedor.

## `src/pipeline/note.ts`

A nota é montada como texto, linha a linha.

```ts
export function renderNote(input: NoteInput): string {
	const { analysis } = input;
	const lines: string[] = [];

	lines.push('---');
	lines.push(`title: ${JSON.stringify(input.title)}`);
	...
	lines.push('---');
	lines.push('');
	lines.push(`# ${input.title}`);
	return `${lines.join('\n').trimEnd()}\n`;
}
```

- `JSON.stringify` entre aspas é uma forma simples de gerar um texto YAML
  válido: se o título tiver aspas ou dois-pontos, o YAML continua
  correto.
- `lines.join('\n')` junta tudo com quebras de linha.
- `trimEnd()` remove as linhas vazias do fim, e `\n` garante que o
  arquivo termina com uma quebra de linha.

O bloco `> [!abstract] Summary` é um *callout* do Obsidian: as linhas
começadas por `>` viram citação, e o `>` do bloco marca o tipo.

```ts
export function formatTimestamp(seconds: number): string {
	const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
	const minutes = Math.floor(safe / 60);
	const rest = safe % 60;
	return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
```

`padStart(2, '0')` completa com zeros à esquerda: `5` vira `05`.

```ts
export function noteFileName(title: string, videoId: string): string {
	const cleaned = title.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
	const base = cleaned.length > 0 ? cleaned : `Study ${videoId}`;
	return `${base}.md`;
}
```

`/g` substitui todas as ocorrências. Os caracteres removidos são os
proibidos no Windows, e o limite de 80 caracteres evita nomes gigantes.

## `src/vault.ts`

```ts
export interface VaultLike {
	getAbstractFileByPath(path: string): unknown;
	createFolder(path: string): Promise<unknown>;
	create(path: string, data: string): Promise<unknown>;
}
```

Essa interface reproduz as três partes do cofre que o plugin usa. Como é
uma interface estrutural, o `Vault` real do Obsidian satisfaz ela sem
precisar de `implements`.

```ts
export async function ensureFolder(vault: VaultLike, folderPath: string): Promise<void> {
	const parts = folderPath.split('/').filter((part) => part.length > 0);
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!vault.getAbstractFileByPath(current)) {
			try {
				await vault.createFolder(current);
			} catch {
				// Another run created the folder in the meantime.
			}
		}
	}
}
```

O caminho é quebrado em partes e cada parte é criada, do nível superior
para baixo. O `try/catch` tolera a corrida em que duas execuções criam a
mesma pasta ao mesmo tempo.

## `src/pipeline/run.ts`

```ts
export async function runPipeline(options: RunOptions): Promise<RunResult> {
	const download = await downloadAudio(options.url, {...});
	report(`Downloaded "${download.title}".`);

	const transcript = await transcribeAudio(download.audioPath, {...});
	report(`Transcribed ${transcript.text.length} characters.`);

	const analysis = await analyzeTranscript(transcript, {...});
	report(`Analysis ready: ${analysis.topic}.`);

	const noteContent = renderNote({...});

	if (!settings.keepAudio) {
		await rm(download.audioPath, { force: true });
	}
	...
}
```

O `report` é a função de progresso: o plugin mostra cada etapa em um
`Notice`. O áudio é apagado no fim, a não ser que o usuário ligue a opção
**Keep the audio file**. `force: true` faz a remoção não falhar quando o
arquivo já não existe.

## Verificação

- `tests/note.test.ts` confere o frontmatter, o callout, os pontos-chave,
  o link de origem, o bloco do transcript e o nome do arquivo.
- `tests/pipeline.test.ts` roda o pipeline inteiro com um `execFile`
  falso e um `fetch` falso: confere o título, a transcrição, a análise e o
  Markdown final.
- `tests/vault.test.ts` confere a criação de pastas (inclusive as
  intermediárias) e o desempate de nomes repetidos.
