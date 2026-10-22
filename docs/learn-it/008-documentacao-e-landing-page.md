# Passo 8 — Documentação, publicação e landing page

## Contexto e comportamento esperado

O plugin é a primeira contribuição open source do projeto. Isso significa
três entregas além do código:

1. **Documentação clara de como publicar** — `docs/PUBLISHING.md`;
2. **Decisões registradas** — `docs/adr/`, com o contexto de cada escolha;
3. **Landing page** — `site/`, com o vídeo de demonstração.

## `docs/PUBLISHING.md`

O guia tem dez seções, na ordem em que o trabalho acontece:

1. o que o Obsidian precisa encontrar no repositório;
2. rodar o plugin na máquina local;
3. a verificação antes de fechar a versão;
4. `manifest.json` e `versions.json` juntos;
5. a release no GitHub;
6. a submissão ao diretório comunitário;
7. o beta público com o BRAT;
8. a landing page;
9. o checklist de release;
10. os problemas comuns.

Os pontos que mais confundem no primeiro release estão explicitados:

- a tag do release tem que ser **igual** ao `version` do manifesto, sem
  prefixo `v`;
- o Obsidian baixa `main.js`, `manifest.json` e `styles.css` do release,
  não do repositório;
- os arquivos precisam ser anexados **soltos**, e não dentro de um zip;
- o `id` e a `description` precisam ser iguais no manifesto e no
  `community-plugins.json`.

O checklist no fim do arquivo é a lista que se copia e cola.

## `docs/adr/`

Um ADR (Architecture Decision Record) registra uma decisão, o contexto que
a motivou e as consequências. O formato é fixo:

```markdown
# 0001 — Título da decisão

## Status

Aceito.

## Contexto
## Decisão
## Consequências
**Positivas**
**Negativas**
## Alternativas descartadas
```

Os dois ADRs deste repositório:

- **0001 — Plugin TypeScript autocontido com BYOK**: por que o plugin foi
  escrito do zero em TypeScript em vez de chamar o Python por HTTP, e o
  que isso custou (a inferência local fica no projeto Python).
- **0002 — yt-dlp como processo externo**: por que o binário não é
  empacotado no release, e o que isso obriga o usuário a fazer.

## `.github/workflows/`

### `ci.yml`

Roda em cada push e em cada pull request: instalação, verificação de
tipos, testes, lint e build. É o que impede um pull request quebrado de
chegar na `main`.

### `release.yml`

```yaml
on:
  push:
    tags:
      - "[0-9]+.[0-9]+.[0-9]+"
```

O padrão da tag só aceita `x.y.z`. Um `v0.1.0` não dispara o workflow,
porque o Obsidian procura a release pela tag exatamente igual à versão.

```yaml
- name: Check that the tag matches the manifest
  run: |
    version=$(node -p "require('./manifest.json').version")
    tag="${GITHUB_REF_NAME}"
    if [ "$version" != "$tag" ]; then
      echo "The tag ($tag) must match the manifest version ($version)."
      exit 1
    fi
```

`node -p` imprime uma expressão JavaScript: `require` lê o manifesto e
`.version` devolve o valor. A comparação impede publicar um release com
versões diferentes.

```yaml
gh release create "$GITHUB_REF_NAME" \
  --title "$GITHUB_REF_NAME" \
  --notes "Automated release of Study Book." \
  main.js manifest.json styles.css
```

O `gh` cria o release e anexa os três arquivos. O token vem de
`GITHUB_TOKEN`, com a permissão `contents: write` declarada no workflow.

### `pages.yml`

Publica a pasta `site/` no GitHub Pages. O passo de upload usa
`actions/upload-pages-artifact` com `path: site`, e o deploy usa
`actions/deploy-pages`. O ambiente `github-pages` é o que registra a URL
pública no resumo do workflow.

## `site/`

A landing page é HTML e CSS puros, sem dependências e sem build. Três
arquivos:

- `index.html` — o conteúdo;
- `styles.css` — o visual;
- `assets/` — o logo, o vídeo e o pôster.

### As regras visuais

A página segue uma paleta quente monocromática (`#F7F6F3` de fundo,
`#111111` de texto, `#EAEAEA` nas bordas) com acentos pastel usados só
para marcar tags. A tipografia alterna uma serifada editorial no título e
uma sans de sistema no texto. Não há sombra pesada, nem gradiente, nem
emoji.

### A revelação ao rolar

```js
const observer = new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				entry.target.classList.add('is-visible');
				observer.unobserve(entry.target);
			}
		}
	},
	{ rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
);
```

O `IntersectionObserver` avisa quando um elemento entra na tela. A classe
`is-visible` é o gatilho do CSS, que faz a transição de `opacity` e
`transform`. Observer é melhor que um evento de `scroll` porque o
navegador faz o cálculo fora do laço principal.

```css
@media (prefers-reduced-motion: no-preference) {
	.reveal {
		opacity: 0;
		transform: translateY(12px);
		transition: opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms ...;
	}
	.reveal.is-visible {
		opacity: 1;
		transform: none;
	}
}
```

A animação só existe quando a pessoa **não** pediu menos movimento. Com
`prefers-reduced-motion: reduce`, o conteúdo aparece pronto.

### O vídeo

```html
<video controls preload="metadata" poster="assets/demo-poster.png" playsinline>
	<source src="assets/demo.mp4" type="video/mp4" />
	Seu navegador não reproduz este vídeo. ...
</video>
```

- `controls` mostra os controles do navegador;
- `preload="metadata"` evita baixar o vídeo inteiro antes de a pessoa
  apertar play;
- `poster` é a imagem exibida antes do primeiro quadro;
- o texto dentro do `<video>` é o conteúdo alternativo, usado quando o
  navegador não reproduz vídeo.

O arquivo `assets/demo.mp4` é real: foi gerado com
`assets/make-demo.py`, que desenha os quadros com Pillow e monta o vídeo
com `ffmpeg` a partir do áudio, da transcrição e da análise de um reel
público. O `assets/README.md` explica como regerar o vídeo ou substituí-lo
por uma gravação de tela do próprio Obsidian.

## Verificação

```bash
npm run typecheck && npm test && npm run lint && npm run build
```

E, para a página:

```bash
chromium --headless --screenshot=/tmp/landing.png --window-size=1280,7200 \
  "file://$PWD/site/index.html"
```
