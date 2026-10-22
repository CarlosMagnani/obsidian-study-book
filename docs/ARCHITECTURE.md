# Arquitetura

## Visão geral

```text
comando do Obsidian
      │
      ▼
src/main.ts ──────────────┐
      │                   │
      ▼                   ▼
src/pipeline/run.ts   src/ui/settings-tab.ts
      │
      ├── src/pipeline/download.ts   (yt-dlp)
      ├── src/pipeline/transcribe.ts  (provedor de transcrição)
      ├── src/pipeline/analyze.ts     (provedor de análise)
      └── src/pipeline/note.ts        (Markdown)
                                   │
                                   ▼
                       src/vault.ts (pasta e nota no cofre)
```

O núcleo (`src/core`, `src/pipeline`, `src/vault.ts`) **não importa
`obsidian`**. Só `src/main.ts` e `src/ui/` conhecem a API do aplicativo.
Essa separação permite rodar os testes com `node --test`, sem Electron e sem
um cofre de verdade.

## Camadas

| Camada | Arquivos | Responsabilidade |
| --- | --- | --- |
| Contrato | `src/core/analysis.ts` | O formato da análise e o JSON Schema enviado aos provedores. |
| Rede | `src/core/http.ts` | `fetch` com tempo limite, repetição e mensagens de erro legíveis. |
| Configuração | `src/core/settings.ts` | Formato das configurações, defaults e diagnóstico de chaves faltando. |
| Prompt | `src/core/prompt.ts` | A instrução de análise e de transcrição, compartilhada por todos os provedores. |
| Provedores | `src/providers/*.ts` | Um arquivo por API. Nada mais conhece os detalhes de um provedor. |
| Pipeline | `src/pipeline/*.ts` | Download, transcrição, análise e renderização da nota. |
| Cofre | `src/vault.ts` | Criação de pastas e de notas. |
| Interface | `src/ui/*.ts`, `src/main.ts` | Modal, configurações e comandos. |

## Provedores (BYOK)

O plugin não tem chave própria. O usuário informa a chave de um provedor e o
plugin fala direto com ele.

| Provedor | Transcrição | Análise | Como pede JSON |
| --- | --- | --- | --- |
| OpenAI | sim | sim | `response_format: json_schema` (modo estrito) |
| Anthropic | não | sim | tool `save_analysis` com `input_schema` |
| Gemini | sim | sim | `generationConfig.responseSchema` |

Três caminhos diferentes para o mesmo resultado existem porque cada API
resolve o problema de uma forma. O contrato `Analysis` é o ponto de
convergência: o resto do plugin só conhece esse formato.

A transcrição e a análise podem usar provedores diferentes. Anthropic, por
exemplo, não transcreve áudio: quem escreve as notas pode ser Claude
enquanto a transcrição sai do OpenAI ou do Gemini.

### Modelo padrão

| Uso | Padrão | Alternativas sugeridas |
| --- | --- | --- |
| Análise (OpenAI) | `gpt-5.6-luna` | `gpt-5.6-terra`, `gpt-6-luna`, `gpt-6-astra` |
| Transcrição (OpenAI) | `gpt-transcribe` | `whisper-1`, `gpt-4o-transcribe` |
| Análise (Anthropic) | `claude-sonnet-5-5` | `claude-haiku-5-5`, `claude-opus-5-5` |
| Análise e transcrição (Gemini) | `gemini-3.8-flash` | `gemini-3-flash-preview` |

O modelo é sempre editável, e o botão **List models** busca a lista real na
API do provedor.

## Download

O `yt-dlp` é executado como processo do sistema, sem shell, com os
argumentos em vetor. Isso evita interpretação de comando e mantém o
código portátil. Se o binário não estiver no `PATH`, o usuário informa o
caminho nas configurações.

O plugin não empacota o `yt-dlp`: o binário é grande, muda por plataforma e
o diretório comunitário do Obsidian só baixa `main.js`, `manifest.json` e
`styles.css` — um executável extra dentro do release não seria instalado
pelo Obsidian.

## Timestamps

Cada provedor entrega timestamps de um jeito:

- **OpenAI** devolve segmentos com `start` e `end` quando o modelo suporta o
  formato `verbose_json`. Quando o modelo recusa esse formato, o plugin
  repete a chamada no formato simples e perde os timestamps.
- **Gemini** não tem timestamps nativos. O prompt pede marcadores `[mm:ss]`,
  e `src/providers/types.ts` converte esses marcadores em segmentos.

Os dois caminhos produzem o mesmo contrato `Transcript`, então a nota
sempre sai igual.

## Decisões

As decisões com contexto estão em [`docs/adr/`](adr/):

- [0001 — Plugin TypeScript autocontido com BYOK](adr/0001-plugin-typescript-byok.md)
- [0002 — yt-dlp como processo externo, sem binário empacotado](adr/0002-yt-dlp-como-processo-externo.md)
