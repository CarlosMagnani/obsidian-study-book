# Passo 1 — Esqueleto do plugin

## Contexto e comportamento esperado

Um plugin do Obsidian é um pacote JavaScript que roda dentro do Electron.
O Obsidian instala a partir de três arquivos de um release do GitHub:
`main.js` (o código compilado), `manifest.json` (a identidade do plugin) e,
opcionalmente, `styles.css`.

Este passo cria o esqueleto do repositório. Ainda não existe nenhuma
funcionalidade: o objetivo é que `npm run build` produza um `main.js` e que
o manifesto já esteja no formato exigido pelo diretório comunitário.

## `manifest.json`

| Linha | Explicação |
| --- | --- |
| `"id": "study-book"` | Identificador único do plugin. Não pode conter a palavra "obsidian" e precisa ser único no catálogo. |
| `"name": "Study Book"` | Nome que aparece na lista de plugins. |
| `"version": "0.1.0"` | Versão no formato `x.y.z`. A tag do release do GitHub precisa ser igual a esse valor, sem prefixo `v`. |
| `"minAppVersion": "1.5.0"` | Versão mais antiga do aplicativo que o plugin suporta. |
| `"description"` | Texto curto usado na busca do diretório. Não pode conter a palavra "Obsidian". |
| `"author"`, `"authorUrl"` | Quem mantém o plugin e onde o Obsidian leva o usuário. |
| `"isDesktopOnly": true` | O plugin executa o `yt-dlp` como processo do sistema, algo que o celular não permite. Declarar isso evita que o usuário instale no celular e descubra que não funciona. |

## `package.json`

| Linha | Explicação |
| --- | --- |
| `"main": "main.js"` | Onde o Obsidian procura o código compilado. |
| `"type": "module"` | O `package.json` usa ES Modules. O `esbuild.config.mjs` também é um módulo ESM. |
| `"dev": "node esbuild.config.mjs"` | Compila em modo watch: cada alteração recompila o `main.js`. |
| `"build": "tsc --noEmit --skipLibCheck && node esbuild.config.mjs production"` | Primeiro verifica os tipos, depois gera o bundle minificado. O `tsc` com `--noEmit` não escreve arquivos: quem gera o JavaScript é o esbuild. |
| `"test": "node --test --no-warnings tests/*.test.ts"` | O runner de testes do próprio Node. O Node executa arquivos `.ts` diretamente, removendo os tipos; `--no-warnings` esconde o aviso experimental. |
| `"allowScripts": { "esbuild": true }` | Permissão para o npm executar o script de instalação do esbuild. Sem isso o binário do esbuild não é baixado e o build falha. |

## `tsconfig.json`

| Opção | Explicação |
| --- | --- |
| `"module": "ESNext"` | O código é escrito com `import`/`export`. |
| `"moduleResolution": "bundler"` | O compilador resolve os imports como um bundler faz. |
| `"allowImportingTsExtensions": true` | Permite escrever `import { x } from './core/analysis.ts'`. O Node e o esbuild precisam da extensão explícita; o compilador só verifica, não emite, por isso a opção é compatível com `"noEmit": true`. |
| `"strict": true` | Liga as verificações estritas do TypeScript: variável possivelmente `undefined`, `null` explícito, etc. |
| `"noUncheckedIndexedAccess": true` | `array[0]` tem o tipo `T | undefined`. É mais seguro, e evita bugs em listas. |
| `"noImplicitOverride": true` | Pede a palavra `override` quando um método sobrescreve o da classe base. O Obsidian já tem `onload` e `display`, então esse aviso aparece com frequência. |
| `"include": ["src/**/*.ts", "tests/**/*.ts"]` | A verificação de tipos cobre o código e os testes. |

## `esbuild.config.mjs`

| Linha | Explicação |
| --- | --- |
| `entryPoints: ['src/main.ts']` | Ponto de entrada do bundle. |
| `bundle: true` | Junta todos os imports num arquivo só. |
| `external: [...]` | Lista de módulos que **não** entram no bundle. `obsidian` é fornecido pelo aplicativo, e os módulos nativos do Node ficam como `require`. |
| `...builtinModules` | Todos os módulos internos do Node (`fs`, `path`, `child_process`...). O `import { builtinModules } from 'node:module'` é a forma oficial de listá-los. |
| `format: 'cjs'` | O Obsidian carrega o plugin com `require`, então o bundle precisa ser CommonJS. |
| `platform: 'node'` | Diz ao esbuild que o código roda em Node, o que permite usar `require('fs')` em vez de tentar bundelar o módulo. |
| `target: 'es2022'` | Nível de JavaScript gerado. |
| `sourcemap: prod ? false : 'inline'` | Em desenvolvimento o sourcemap fica dentro do arquivo, para o depurador mostrar a linha original. Em produção não. |
| `minify: prod` | Só o bundle de produção é minificado. |
| `await context.rebuild(); process.exit(0)` | No modo produção o processo precisa terminar, senão o esbuild fica esperando. |

## `versions.json`

```json
{
	"1.5.0": "0.1.0",
	"1.14.4": "0.1.0"
}
```

O Obsidian lê esse arquivo quando a `minAppVersion` do `manifest.json` é maior
que a versão do aplicativo instalada: ele escolhe a versão mais antiga do
plugin que ainda funciona naquele aplicativo.

## Verificação

```bash
npm install
npm run build
```

O build precisa terminar sem erro e produzir `main.js` na raiz. Esse arquivo
está no `.gitignore`: ele é gerado, nunca commitado.
