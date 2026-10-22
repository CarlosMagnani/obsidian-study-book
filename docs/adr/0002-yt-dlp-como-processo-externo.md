# 0002 — yt-dlp como processo externo, sem binário empacotado

## Status

Aceito.

## Contexto

O Obsidian baixa, na instalação de um plugin, apenas três arquivos do
release do GitHub: `main.js`, `manifest.json` e `styles.css`. Qualquer
outro arquivo anexado ao release não chega ao usuário.

O `yt-dlp` é um binário de cerca de 3 MB no Linux, 10 MB no macOS e 15 MB
no Windows, com uma versão diferente por plataforma. Embutir as três
versões no repositório significaria versionar binários no Git.

## Decisão

O plugin executa o `yt-dlp` que já está na máquina do usuário.

- A busca procura `yt-dlp` no `PATH` (e `yt-dlp.exe` no Windows).
- As configurações aceitam um caminho customizado, para quem instalou o
  binário em outro lugar.
- O comando **Detect** mostra qual binário foi encontrado.
- A execução usa `execFile` com os argumentos em vetor, sem shell: nenhum
  argumento vindo da URL é interpretado como comando.

## Consequências

**Positivas**

- O release do plugin continua pequeno e legível.
- O `yt-dlp` continua sendo atualizado pelo próprio projeto, sem trabalho
  para o plugin.
- O usuário controla a versão do binário, o que importa porque o
  Instagram muda de layout com frequência.

**Negativas**

- O plugin não funciona em uma máquina sem `yt-dlp`. A tela de configurações
  e o comando **Check the setup** avisam sobre isso, e o README traz o
  requisito na primeira seção.
- O plugin não funciona no celular, e por isso declara
  `isDesktopOnly: true`.

## Alternativas descartadas

**Baixar o binário no primeiro uso.** O plugin poderia baixar a versão
correta do `yt-dlp` para a pasta do plugin, com verificação de checksum.
Isso foi deixado para depois: aumenta a superfície de segurança (executar
um binário baixado) e a complexidade do plugin. Se a comunidade pedir, a
mudança cabe em `src/pipeline/download.ts`.
