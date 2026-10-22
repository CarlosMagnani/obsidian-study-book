# AGENTS.md

Regras para agentes que trabalham neste repositório.

## Escopo

Este repositório contém **um** plugin do Obsidian: o código TypeScript em
`src/`, o manifesto, a landing page em `site/` e a documentação em `docs/`.

O projeto Python que originou as mesmas etapas (ingestão, transcrição,
análise) vive em outro repositório, `study-book`. Não mova código Python
para cá e não crie aqui um segundo núcleo de pipeline: o plugin é
TypeScript, do começo ao fim.

## Estrutura do projeto

```text
/
├── manifest.json          # manifesto do plugin (id, versão, minAppVersion)
├── versions.json          # versão do plugin por versão mínima do Obsidian
├── src/
│   ├── core/              # contrato de análise, HTTP, settings, prompt
│   ├── providers/         # um arquivo por provedor de API (BYOK)
│   ├── pipeline/          # download, transcrição, análise, nota
│   ├── ui/                # modal e tela de configurações
│   ├── vault.ts           # criação de pastas e notas no cofre
│   └── main.ts            # entrada do plugin: comandos e ícones
├── tests/                 # testes com node:test (sem depender do Obsidian)
├── docs/                  # documentação e notas de aprendizado
├── site/                  # landing page estática (GitHub Pages)
└── .github/workflows/     # CI e publicação de release
```

Regras depaths:

- Código de aplicação em `src/`.
- Testes em `tests/`, espelhando o módulo que cobrem.
- Documentação do projeto em `docs/`; decisões de arquitetura em
  `docs/adr/`.
- Artefatos gerados (o `main.js` do bundle) nunca são commitados; o
  `.gitignore` já cuida disso.

## Comandos

```bash
npm install       # instala as dependências
npm run dev       # compila em modo watch (main.js)
npm run build     # typecheck + bundle de produção
npm run typecheck # só a verificação de tipos
npm test          # testes com node:test
npm run lint      # ESLint
```

Antes de entregar qualquer mudança, rode `npm run typecheck`, `npm test` e
`npm run build`.

## Notas de aprendizado

Este projeto é um exercício de aprendizado. Para cada passo de
implementação não trivial, crie ou atualize **uma** nota em português em
`docs/learn-it/`.

Cada nota deve:

- nomear o arquivo de origem;
- explicar o contexto da mudança e o comportamento esperado;
- explicar, linha a linha, o que foi adicionado ou alterado, incluindo a
  sintaxe TypeScript usada.

Uma nota por passo, para o aluno conseguir acompanhar o projeto em ordem.
A regra não vale para artefatos gerados, mudanças só de dependência ou
edições só de documentação.

## Regras do plugin

- **BYOK é obrigatório.** O plugin nunca embute uma chave de API. Toda
  chamada usa a chave que o usuário configurou, e a chave fica apenas no
  `data.json` do plugin dentro do cofre.
- Um provedor novo entra em `src/providers/`, implementa a interface
  `Provider` e é registrado em `src/providers/index.ts`. Nenhum outro
  arquivo deve conhecer a API de um provedor.
- O núcleo (`src/core`, `src/pipeline`, `src/vault.ts`) não importa `obsidian`.
  Isso mantém o código testável fora do aplicativo. Só `src/main.ts` e
  `src/ui/` importam `obsidian`.
- Toda requisição externa passa por `src/core/http.ts`, que já trata
  tempo limite, repetição e mensagem de erro.

## Publicação

O passo a passo de publicação está em `docs/PUBLISHING.md`. Leia esse
arquivo antes de criar uma tag ou de submeter o plugin ao diretório
comunitário.
