# 0001 — Plugin TypeScript autocontido com BYOK

## Status

Aceito.

## Contexto

O projeto nasceu como um pacote Python (`study-book`) que ingere o áudio de
um vídeo do Instagram, transcreve com Faster-Whisper local e analisa com um
modelo do Ollama. A mesma ideia agora precisa virar um plugin do Obsidian,
publicado no catálogo comunitário, e o usuário pediu um modelo BYOK com
suporte aos principais provedores de API, tendo a OpenAI como padrão.

Um plugin do Obsidian é um pacote TypeScript que roda dentro do Electron.
Ele pode ser distribuído pelo diretório comunitário, o que significa que a
instalação precisa ser um único arquivo `main.js` mais o manifesto.

## Decisão

O plugin é escrito do zero em TypeScript, sem servidor e sem sidecar
Python:

- download com `yt-dlp`, executado como processo do sistema;
- transcrição e análise por API, usando a chave que o usuário configurou
  (BYOK);
- OpenAI como provedor padrão de análise e transcrição, com Anthropic e
  Gemini também disponíveis;
- nota Markdown escrita no cofre, com o mesmo contrato de análise do projeto
  Python.

O núcleo do plugin (`src/core`, `src/pipeline`, `src/vault.ts`) não importa
`obsidian`, o que mantém os testes rodando em Node puro.

## Consequências

**Positivas**

- Instalação com um clique no catálogo comunitário, sem Python e sem pip.
- Nenhuma chave do projeto: quem usa paga a própria API, e o plugin não
  precisa de servidor nem de orçamento.
- O mesmo contrato de análise nos dois projetos, então uma nota do plugin e
  uma nota da CLI descrevem o mesmo material.
- Testes rodam em segundos, sem rede e sem aplicativo.

**Negativas**

- O core Python deixa de ser usado pelo plugin. Ele continua existindo como
  projeto de linha de comando, com a mesma lógica e o mesmo formato de saída.
- A transcrição local (Faster-Whisper) e a análise local (Ollama) não
  existem no plugin. Quem quer inferência local usa o projeto Python.
- O plugin é `isDesktopOnly`, porque precisa executar o `yt-dlp`.

## Alternativas descartadas

**Sidecar Python.** O plugin chamaria a CLI Python por HTTP local. Preserva
o core existente, mas obriga o usuário a instalar Python e um pacote, o que
derruba a taxa de instalação de um plugin de diretório comunitário.

**Reescrever tudo com o modelo local dentro do plugin.** Distribuir pesos de
Whisper dentro de um release de plugin é inviável: o Obsidian baixa apenas
`main.js`, `manifest.json` e `styles.css`.

**Manter só o Ollama.** Resolve a questão do custo, mas amarra o usuário a
uma máquina com GPU e Ollama instalado, e não atende o pedido de BYOK com
vários provedores.
