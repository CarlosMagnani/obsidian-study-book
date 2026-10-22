# Passo 7 — Testes sem aplicativo

## Contexto e comportamento esperado

O plugin precisa de testes que rodem em segundos, sem Electron, sem cofre
e sem internet. Para isso, duas decisões:

1. o núcleo (`src/core`, `src/pipeline`, `src/vault.ts`) **não importa**
   `obsidian`;
2. tudo que depende do mundo externo (rede, `yt-dlp`, relógio) entra por
   injeção.

O runner é o do próprio Node: `node --test tests/*.test.ts`. O Node
executa arquivos TypeScript diretamente, removendo os tipos.

## A organização

```text
tests/
├── analysis.test.ts     # o contrato de análise
├── note.test.ts         # o Markdown da nota
├── pipeline.test.ts     # o fluxo inteiro
├── providers.test.ts    # cada API
├── settings.test.ts     # a configuração
├── vault.test.ts        # a criação de pastas e notas
└── helpers/fakes.ts     # o fetch e os utilitários falsos
```

## `tests/helpers/fakes.ts`

```ts
export function fakeFetch(responses: FakeResponse[]): FakeFetch {
	const requests: RecordedRequest[] = [];
	let index = 0;
	const fetchImpl: FetchLike = async (url, init) => {
		requests.push({ url, init: init ?? {} });
		const response = responses[Math.min(index, responses.length - 1)];
		index += 1;
		if (!response) {
			throw new Error('the fake fetch ran out of canned responses');
		}
		const status = response.status ?? 200;
		const body = response.text ?? JSON.stringify(response.body ?? {});
		return new Response(body, {
			status,
			headers: { 'content-type': 'application/json' },
		});
	};
	return { fetchImpl, requests };
}
```

- O `fetch` falso guarda cada requisição e devolve uma resposta
  programmed. O array `responses` é consumido em ordem, e o último
  elemento se repete: assim o teste não precisa saber quantas chamadas
  o código faz.
- `new Response(body, { status })` usa a classe `Response` real do Node,
  então o código de produção exercita o mesmo caminho de dados.
- `requests` permite conferir o que foi enviado: URL, cabeçalhos e corpo.

```ts
export async function requestForm(request: RecordedRequest): Promise<FormData> {
	const body = request.init.body;
	if (!(body instanceof FormData)) {
		throw new Error('the request body is not a FormData');
	}
	return body;
}
```

`instanceof` confere o tipo real do objeto. O corpo do envio do áudio é
um `FormData`, e o teste lê os campos dele.

## `tests/providers.test.ts`

```ts
const fake = fakeFetch([
	{
		body: {
			text: 'Hello world',
			language: 'en',
			segments: [{ start: 0, end: 2.5, text: 'Hello world' }],
		},
	},
]);

const transcript = await openaiProvider.transcribe({...}, {
	apiKey: 'sk-test',
	model: 'gpt-transcribe',
	baseUrl: 'https://api.openai.com/v1',
	fetchImpl: fake.fetchImpl,
});

assert.equal(fake.requests[0]?.url, 'https://api.openai.com/v1/audio/transcriptions');
```

O `?.` depois de `fake.requests[0]` é o acesso opcional: se não houver
requisição, o valor é `undefined` em vez de um erro. Combinado com
`assert.equal`, o teste falha com uma mensagem clara em vez de estourar.

O teste do plano B do `verbose_json` passa duas respostas: a primeira é um
erro 400 e a segunda é a resposta boa.

```ts
const headers = fake.requests[0]?.init.headers as Record<string, string>;
assert.equal(headers.Authorization, 'Bearer sk-test');
```

Os cabeçalhos vêm tipados como `HeadersInit`, que pode ser um objeto, uma
lista de pares ou Headers. O `as Record<string, string>` diz ao
compilador que, neste caso, é um objeto.

## `tests/pipeline.test.ts`

```ts
const impl = ((
	command: string,
	args: string[],
	_options: unknown,
	callback?: (error: Error | null, stdout: string, stderr: string) => void,
) => {
	calls.push({ command, args });
	if (!callback) {
		return {} as never;
	}
	const stdout = JSON.stringify({
		id: 'abc123',
		title: 'How sleep works',
		requested_downloads: [{ filepath: audioPath }],
	});
	callback(null, stdout, '');
	return {} as never;
}) as unknown as NonNullable<Parameters<typeof runPipeline>[0]['execFileImpl']>;
```

O `execFile` real tem duas formas: com callback (para esperar) e sem
callback (para executar). O falso precisa respeitar as duas: quando não
há callback, devolve um objeto vazio; quando há, chama o callback com o
JSON que o `yt-dlp` imprimiria.

O `as unknown as ...` é uma conversão dupla, necessária porque a
assinatura do `execFile` do Node é muito específica e o falso é uma
função simples. O teste continua verificando o comportamento.

O teste cria um arquivo de áudio de verdade em uma pasta temporária:

```ts
const workDir = await mkdtemp(path.join(tmpdir(), 'study-book-'));
const audioPath = path.join(workDir, 'abc123.m4a');
await writeFile(audioPath, 'fake audio bytes');
```

`mkdtemp` cria uma pasta única e devolve o caminho dela. O arquivo falso
existe porque o `transcribeAudio` lê o áudio do disco de verdade.

## `tests/vault.test.ts`

```ts
class FakeVault implements VaultLike {
	readonly folders = new Set<string>();
	readonly files = new Map<string, string>();

	getAbstractFileByPath(path: string): unknown {
		if (this.folders.has(path) || this.files.has(path)) {
			return { path };
		}
		return null;
	}
	...
}
```

A classe implementa a interface `VaultLike` do módulo `src/vault.ts`.
Como a interface é estrutural, qualquer objeto com esses três métodos
serve, e o compilador garante que a forma bate.

`Set` guarda valores sem repetir e `Map` guarda pares chave/valor: são as
estruturas certas para "o que já existe".

## Verificação

```bash
npm test
```

Resultado esperado: 34 testes, todos passando, em menos de um segundo, sem
nenhuma requisição de rede.
