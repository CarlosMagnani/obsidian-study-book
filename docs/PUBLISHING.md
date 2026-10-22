# Como publicar o plugin Study Book

Este é o passo a passo completo de publicação: do código local até o plugin
instalável dentro do Obsidian. Cada etapa explica **o que fazer**, **por
que** e **como conferir**.

As regras oficiais estão em
[Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
e em [Submission requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins).

---

## 1. O que o Obsidian precisa encontrar no repositório

Antes de qualquer release, o repositório precisa ter, na raiz:

| Arquivo | Para quê |
| --- | --- |
| `README.md` | Aparece na página do plugin no diretório comunitário. |
| `LICENSE` | Define como o código pode ser usado. Aqui é MIT. |
| `manifest.json` | Identifica o plugin: `id`, `name`, `version`, `minAppVersion`, `description`, `author`. |
| `main.js` | O código compilado. **Não é commitado**: sai do build. |
| `styles.css` | Opcional. Existe aqui só para o modal e a tela de configurações. |

Regras do `manifest.json` que a revisão automática checa:

- `id` único em todo o diretório e **sem a palavra "obsidian"**. O nosso é
  `study-book`.
- `version` no formato `x.y.z`, sem prefixo. Exemplo: `0.1.0`.
- `description` curta e sem a palavra "Obsidian".
- `minAppVersion` com a versão mais antiga do aplicativo que o plugin
  realmente suporta. Aqui é `1.5.0`, porque o plugin usa apenas a API
  estável (`Plugin`, `Modal`, `PluginSettingTab`, `Setting`, `Notice`).
- `isDesktopOnly: true`, porque o plugin executa o `yt-dlp` como processo do
  sistema. Isso é honesto: em celular não existe binário para executar.

## 2. Rodar o plugin na sua máquina

```bash
git clone https://github.com/CarlosMagnani/obsidian-study-book.git
cd obsidian-study-book
npm install
npm run dev
```

`npm run dev` fica observing e recompila `main.js` a cada alteração.

Para instalar no seu cofre de testes:

```bash
mkdir -p "<seu cofre>/.obsidian/plugins/study-book"
cp main.js manifest.json styles.css "<seu cofre>/.obsidian/plugins/study-book/"
```

Depois, no Obsidian: **Settings → Community plugins → Community plugins**
(ative o modo), reinicie o aplicativo e ative o **Study Book**. O comando
**Study Book: Check the setup** mostra se o `yt-dlp` e as chaves foram
encontrados.

> Use sempre um cofre de testes. Um plugin em desenvolvimento pode escrever
> notas onde você não espera.

## 3. Verificação antes de fechar a versão

```bash
npm run typecheck   # erros de tipo
npm test            # 34 testes, sem rede
npm run lint        # estilo e regras do plugin
npm run build       # typecheck + main.js de produção
```

O `main.js` gerado pelo build de produção é minificado e não tem sourcemap.
É exatamente esse arquivo que vai para o release.

## 4. Versão: `manifest.json` e `versions.json` juntos

Toda versão publicada precisa de duas mudanças:

1. `manifest.json`: suba o `version` (exemplo: `0.1.0` → `0.1.1`).
2. `versions.json`: registre qual versão do plugin serve a partir de qual
   versão do aplicativo.

```json
{
	"1.5.0": "0.1.1",
	"1.14.4": "0.1.1"
}
```

O Obsidian lê esse arquivo quando a `minAppVersion` do `manifest.json` é
maior que a versão do aplicativo em uso, para escolher a versão mais
antiga que ainda funcione.

Regra de versionamento (SemVer):

- **patch** (`0.1.1`): correção de bug, sem mudança de comportamento.
- **minor** (`0.2.0`): comando novo, opção nova, provedor novo.
- **major** (`1.0.0`): mudança que quebra algo que o usuário configurou.

## 5. Publicar a release no GitHub

O Obsidian baixa `main.js`, `manifest.json` e `styles.css` **do release do
GitHub**, e não do repositório. Por isso a release é obrigatória.

A tag do release tem que ser **igual** ao `version` do `manifest.json`,
inclusive sem o prefixo `v`:

```bash
npm run build
git add -A
git commit -m "release: 0.1.0"
git tag 0.1.0
git push origin main
git push origin 0.1.0
```

O workflow `.github/workflows/release.yml` faz o resto: compila o plugin e
anexa os arquivos ao release recém-criado.

Se preferir criar o release pela interface do GitHub:

1. **Releases → Draft a new release**.
2. **Choose a tag** → digite `0.1.0` (sem `v`) → **Create new tag**.
3. **Release title**: `0.1.0`.
4. Anexe, como arquivos individuais:
   - `main.js`
   - `manifest.json`
   - `styles.css`
5. **Publish release**.

> Anexe os arquivos soltos. O Obsidian não lê `source.zip` nem o código
>-fonte do tag.

Conferência rápida:

```bash
gh release view 0.1.0 --json assets --jq '.assets[].name'
# deve listar main.js, manifest.json, styles.css
```

## 6. Submeter ao diretório comunitário

Depois do primeiro release publicado, o plugin pode entrar no catálogo do
Obsidian, onde aparece na busca de plugins.

1. Crie uma conta em [community.obsidian.md](https://community.obsidian.md)
   (a mesma conta do aplicativo).
2. Vincule sua conta do GitHub. É assim que o diretório confirma que o
   repositório é seu.
3. **Add your plugin** e cole a URL do repositório.
4. O diretório lê o `manifest.json` da **branch padrão** do repositório. Por
   isso o `manifest.json` precisa estar commitado e correto **antes** de
   submeter.
5. A revisão é automática e mostra o que precisa ser corrigido. Corrija,
   publique uma nova versão e o diretório reprocessa.

Se preferir o caminho antigo, o PR vai para
[obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases),
adicionando uma entrada em `community-plugins.json`:

```json
{
	"id": "study-book",
	"name": "Study Book",
	"author": "Carlos Magnani",
	"description": "Turn a video URL into a study note in your vault, with your own API key.",
	"repo": "CarlosMagnani/obsidian-study-book"
}
```

Regras do `community-plugins.json`:

- O `id` precisa ser igual ao `manifest.json`.
- A `description` precisa ser igual à do `manifest.json`.
- A `description` não pode conter a palavra "Obsidian".

### Antes de submeter, o checklist do revisor

- [ ] Testado no Windows, no macOS e no Linux.
- [ ] Release contém `main.js`, `manifest.json` e `styles.css` como arquivos
      individuais.
- [ ] O nome do release é exatamente a versão, sem `v`.
- [ ] O `id` do `manifest.json` é o mesmo do `community-plugins.json`.
- [ ] `README.md` explica o que o plugin faz e como usar.
- [ ] `LICENSE` existe.
- [ ] As políticas do desenvolvedor foram lidas e o plugin está de acordo.
- [ ] Nada de sistema de arquivos específico de uma plataforma: o plugin usa
      a API do cofre para escrever as notas.
- [ ] Nenhuma chave de API no código.

## 7. Beta público com o BRAT

Antes de submeter, dá para liberar um beta para testadores usarem o plugin
sem esperar a revisão do diretório:

1. Instale o plugin
   [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).
2. No BRAT, **Add beta plugin** e informe `CarlosMagnani/obsidian-study-book`.
3. Cada teste recebe as versões de beta da branch `beta` ou `main`.

O BRAT é a ponte recomendada entre "terminei o código" e "a comunidade
pode testar".

## 8. A landing page

A landing page vive em `site/` e é publicada pelo GitHub Pages:

- `.github/workflows/pages.yml` compila `site/` e publica em
  `https://<usuário>.github.io/<repositorio>/`.
- Para ligar: **Settings → Pages → Source → GitHub Actions**.

O vídeo de demonstração fica em `site/assets/`. O arquivo esperado é
`demo.mp4`; o README da pasta explica como gravar um vídeo curto da tela
com o comando **Ctrl/Cmd+P → Developer: Record Demo** do próprio Obsidian.

## 9. Checklist de release

```text
[ ] npm run typecheck
[ ] npm test
[ ] npm run lint
[ ] npm run build
[ ] manifest.json com a versão nova
[ ] versions.json atualizado
[ ] commit da versão
[ ] tag igual à versão, sem "v"
[ ] release com main.js, manifest.json e styles.css
[ ] (primeira vez) submissão ao diretório comunitário
[ ] anúncio no fórum e no Discord
```

## 10. Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| O plugin não aparece na busca | Não foi publicado no diretório ainda | Use a instalação manual ou o BRAT. |
| `yt-dlp was not found` | O binário não está no `PATH` | Instale o yt-dlp ou informe o caminho nas configurações. |
| `authentication failed (401)` | Chave inválida ou de outro provedor | Confira a chave e o provedor selecionado. |
| `rate limited (429)` | many requests | O plugin já repete a chamada; espere alguns instantes. |
| `provider did not return valid JSON` | O modelo ignorou o formato pedido | Troque o modelo pelas sugestões da tela de configurações. |
| O Instagram pede login | Post exige cookies | Selecione "Cookies from browser" nas configurações. |
| A tag não encontra o release | A tag tem `v` e a versão não tem | A tag precisa ser igual ao `version`, sem prefixo. |
