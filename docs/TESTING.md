# Como testar o Study Book

Este guia cobre os quatro níveis de teste do plugin: os testes
automatizados, o teste manual no cofre de desenvolvimento, o beta com
testadores reais e a verificação automática do diretório comunitário.

## 1. Testes automatizados (sem aplicativo, sem rede)

```bash
npm install
npm run typecheck   # erros de tipo
npm test            # 34 testes, todos com fetch e yt-dlp falsos
npm run lint        # estilo e as regras oficiais do plugin do Obsidian
npm run build       # gera o main.js de produção
```

O esperado: zero erros em todos os comandos e `34 pass, 0 fail` no teste.
O `npm test` não chama nenhuma API e não baixa nada: os provedores são
testados com respostas programadas e o `yt-dlp` com um executável falso.

## 2. Testar no cofre de desenvolvimento

Nunca teste no seu cofre de verdade. Um plugin em desenvolvimento pode
criar notas onde você não espera.

### Preparar o cofre

1. Crie um cofre vazio, só para testes.
2. No repositório, rode `npm run dev` (recompila a cada alteração).
3. Copie para o cofre de testes:
   `<cofre>/.obsidian/plugins/study-book/main.js`,
   `manifest.json` e `styles.css`.
4. No Obsidian: **Settings → Community plugins**, ative o modo e habilite
   o **Study Book**.

Para cada mudança de código, recarregue o plugin: desative e ative de
novo, ou rode **Reload app without saving** na paleta de comandos
(`Ctrl/Cmd + P`). O plugin [Hot Reload](https://github.com/pjeby/hot-reload)
faz isso sozinho.

### O primeiro diagnóstico

Rode o comando **Study Book: Check the setup**. Ele informa:

- se o `yt-dlp` foi encontrado (e qual caminho);
- se as chaves configuradas estão presentes.

Se o `yt-dlp` não aparece, instale de
[github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) ou informe o
caminho completo nas configurações do plugin.

### O teste de ponta a ponta

Use um vídeo **curto e público** (um reel de menos de um minuto). Custa
centavos e termina em segundos.

1. **Settings → Study Book**: escolha o provedor de análise e o de
   transcrição, cole a chave e aperte **Test connection**.
2. Abra a paleta e rode **Study Book: Create a study note from a video URL**.
3. Cole a URL e confirme.
4. Acompanhe a notificação de progresso: download, transcrição e análise.
5. Confira a nota criada na pasta configurada:
   - o frontmatter tem `title`, `source`, `video_id`, `topic`, `language`,
     `provider`, `model`, `created` e a tag `study-book`;
   - o resumo e os pontos-chave fazem sentido com o vídeo;
   - a seção **Moments** aponta para os minutos certos;
   - o **Source** abre o vídeo original;
   - o transcript aparece recolhido no bloco `<details>`.

### Quanto custa um teste

Valores aproximados, confira a tabela de preços do provedor:

| Etapa | Custo típico de um reel de 1 min |
| --- | --- |
| Transcrição (OpenAI) | alguns centavos por minuto de áudio |
| Análise (gpt-5.6-luna) | fração de centavo (a transcrição tem poucas centenas de tokens) |
| Transcrição + análise (Gemini flash) | pode sair de graça dentro da cota gratuita |

Dica: teste a análise primeiro com o comando **Analyze a transcript that
you already have**, colando qualquer texto. Ele não baixa nada e não
transcreve, então o custo é só o da análise.

### Os caminhos de erro (teste cada um)

| Cenário | O que deve acontecer |
| --- | --- |
| URL sem `https://` | Aviso imediato, sem chamar a rede |
| Sem chave configurada | Aviso pedindo para abrir as configurações |
| Chave errada | `authentication failed (401)` na notificação |
| Provedor fora do ar | O plugin repete a chamada e avisa se persistir |
| yt-dlp não instalado | `yt-dlp was not found` com o link de instalação |
| Post do Instagram com login | Aviso do yt-dlp; ative **Cookies from browser** |
| Análise via Anthropic sem chave de transcrição | Aviso de que a transcrição precisa de OpenAI ou Gemini |

### Onde ver os erros

Abra as ferramentas de desenvolvedor (`Ctrl/Cmd + Shift + I`) e olhe o
**Console**. O plugin não escreve log de depuração: o console mostra só
erros, como pede o guia oficial.

## 3. Matriz de teste (o que a revisão checa)

Antes de submeter, rode o teste de ponta a ponta em:

- [ ] Windows
- [ ] macOS
- [ ] Linux
- [ ] yt-dlp no `PATH` e com caminho customizado
- [ ] OpenAI (análise + transcrição)
- [ ] Anthropic (análise) com Gemini ou OpenAI (transcrição)
- [ ] Gemini (análise + transcrição)
- [ ] reel curto e reel com mais de 2 minutos
- [ ] pasta de notas com subpastas (`Study Book/2026`)
- [ ] nome de vídeo com caracteres inválidos no Windows (`: ? " < > |`)

Ocelular não entra na matriz: o manifesto declara `isDesktopOnly: true`.

## 4. Beta com testadores reais (BRAT)

1. Instale o plugin
   [BRAT](https://obsidian.md/plugins?id=obsidian42-brat) no seu Obsidian.
2. No BRAT, **Add beta plugin** e informe
   `CarlosMagnani/obsidian-study-book`.
3. Peça para uma ou duas pessoas instalarem pelo BRAT e rodarem o fluxo.
4. Corrija o que aparecer, publique uma versão nova e o BRAT atualiza.

## 5. Verificação automática do diretório

A submissão passa por uma revisão automática. Duas formas de antecipar o
resultado:

1. **Local:** o `npm run lint` já usa
   [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin-obsidianmd),
   o plugin oficial de regras. Lint limpo significa zero violação
   detectável localmente.
2. **No painel:** o diretório comunitário permite um *preview scan* em
   qualquer branch, tag ou commit, sem publicar. Rode o scan na tag
   candidata antes de submeter.

## Checklist antes de cada release

```text
[ ] npm run typecheck
[ ] npm test (34 pass, 0 fail)
[ ] npm run lint
[ ] npm run build
[ ] teste de ponta a ponta no cofre de testes
[ ] caminhos de erro conferidos
[ ] manifest.json com a versão nova
[ ] versions.json atualizado
[ ] tag igual à versão, sem "v"
[ ] release com main.js, manifest.json e styles.css
```
