# Passo 2 — Contrato de análise e camada de rede

## Contexto e comportamento esperado

Dois módulos formam a base de todo o resto:

- `src/core/analysis.ts` define **o que** é uma análise e como validar a
  resposta do modelo. É o mesmo contrato do projeto Python: tópico,
  resumo, pontos-chave, timestamps e idioma.
- `src/core/http.ts` define **como** falar com uma API: tempo limite,
  repetição em caso de limite de taxa e mensagens de erro legíveis.

Nenhum dos dois importa `obsidian`. Isso permite testar o código em Node
puro, sem aplicativo.

## `src/core/analysis.ts`

### A interface

```ts
export interface SourceTimestamp {
	start: number;
	end: number;
	label: string;
}

export interface Analysis {
	topic: string;
	summary: string;
	key_points: string[];
	timestamps: SourceTimestamp[];
	language: string;
}
```

`interface` descreve o formato de um objeto. As linhas de `timestamps` e
`key_points` são listas: `string[]` é uma lista de textos e
`SourceTimestamp[]` é uma lista de objetos com três campos.

### O JSON Schema

```ts
export const ANALYSIS_JSON_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['topic', 'summary', 'key_points', 'timestamps', 'language'],
	properties: { /* ... */ },
} as const;
```

- `type: 'object'` e `properties` descrevem o formato do JSON.
- `additionalProperties: false` proíbe campos extras. É exigência do modo
  estrito da OpenAI, então o mesmo schema serve para todos os provedores.
- `required` lista os campos que não podem faltar.
- `as const` transforma o objeto em um tipo literal: o TypeScript passa a
  saber exatamente quais chaves existem, em vez de aceitar qualquer string.

### A validação

```ts
export function parseAnalysis(value: unknown): Analysis {
	if (typeof value === 'string') {
		try {
			return parseAnalysis(JSON.parse(value));
		} catch (error) {
			throw new AnalysisError(
				`provider did not return valid JSON: ${(error as Error).message}`,
			);
		}
	}
	...
}
```

- `value: unknown` significa "pode ser qualquer coisa". A função é
  responsável por descobrir o que é.
- `typeof value === 'string'` testa o tipo. Um modelo pode devolver o JSON
  como texto dentro de uma string, e nesse caso a função chama a si mesma
  com o objeto já interpretado. Isso se chama *recursão*.
- `(error as Error).message` converte o erro desconhecido para `Error` para
  ler a mensagem. O `as` não verifica nada em tempo de execução: é uma
  afirmação para o compilador.

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

Esse é um **type guard**: o `value is Record<string, unknown>` na assinatura
faz o TypeScript estreitar o tipo da variável dentro do `if`. `value !== null`
é necessário porque `typeof null` devolve `"object"`.

No fim, os campos opcionais são normalizados: `key_points` vira lista
vazia, `timestamps` vira lista vazia e `language` vira `"unknown"`. Só
`topic` e `summary` são obrigatórios, porque uma análise sem eles não
serve para nada.

## `src/core/http.ts`

```ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
```

Um tipo de função. `init?` é opcional (o `?` marca isso). `Promise<Response>`
significa que a função devolve uma promessa que se resolve na resposta.

### O erro

```ts
export class HttpError extends Error {
	readonly status: number;
	readonly body: string;
	readonly retryAfter: string | null;
}
```

`extends Error` faz a classe herdar o comportamento de `Error` (mensagem,
`stack`). `readonly` impede que o status seja mudado depois de criado.

### A repetição

```ts
for (let attempt = 0; attempt <= retries; attempt++) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(url, { ...init, signal: controller.signal });
		...
	} catch (error) {
		const status = error instanceof HttpError ? error.status : 0;
		const aborted = error instanceof Error && error.name === 'AbortError';
		if (attempt >= retries || (!aborted && status > 0 && !isRetryable(status))) {
			throw error;
		}
		await sleep(retryDelay(attempt, retryAfter));
	} finally {
		clearTimeout(timer);
	}
}
```

- `let attempt = 0` cria uma variável que pode ser mudada; `const` seria
  impossível aqui.
- `new AbortController()` cria um sinal que cancela a requisição.
  `controller.abort()` é chamado quando o tempo estoura.
- `{ ...init, signal: controller.signal }` copia as opções da requisição e
  troca o sinal: o operador de espalhamento `...` copia as propriedades de
  um objeto para outro.
- `error instanceof HttpError` verifica o tipo do erro capturado.
- A condição de saída mistura três casos: as tentativas acabaram, o erro
  não vale a pena repetir (401, por exemplo) ou o pedido foi cancelado.
- `finally` sempre roda, mesmo com erro. É lá que o temporizador é
  apagado, para o processo não ficar pendurado.

`isRetryable` só aceita 408, 409, 425, 429 e erros de servidor (500 ou
mais). Uma chave errada não melhora na segunda tentativa: insistir só gera
custo.

### Base64

```ts
export function toBase64(bytes: Uint8Array): string {
	const chunkSize = 0x8000;
	let binary = '';
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return btoa(binary);
}
```

O Gemini recebe o áudio como base64. O passo de `0x8000` (32 KB) existe
porque `String.fromCharCode(...bytes)` com um arquivo grande estoura a
pilha de chamadas. O texto é dividido em pedaços pequenos e o resultado é
concatenado.

## Verificação

`tests/analysis.test.ts` cobre o contrato: payload completo, JSON em
string, campos opcionais faltando, payload sem tópico e JSON inválido.
`tests/providers.test.ts` usa um `fetch` falso, então nenhuma requisição
sai para a internet durante os testes.
