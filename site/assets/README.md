# Assets da landing page

## `demo.mp4` e `demo-poster.png`

O vídeo de demonstração usa **dados reais** do pipeline:

- o áudio de um reel público do Instagram;
- a transcrição production pelo Faster-Whisper;
- a análise escrita por um modelo de linguagem.

Ele mostra as três etapas: o reel de entrada, a transcrição surgindo e a
nota final como o Obsidian mostra.

### Como o vídeo foi gerado

```bash
python -m venv .venv
.venv/bin/pip install pillow
.venv/bin/python make-demo.py <pasta-do-video> demo.mp4 demo-poster.png
```

A pasta do vídeo precisa ter `audio.m4a`, `transcript.json` e `analysis.json`,
no mesmo formato usado pelo projeto `study-book`. O script desenha os
quadros com Pillow e monta o MP4 com `ffmpeg`.

### Como trocar por uma gravação de tela

Uma gravação do Obsidian é mais honesta sobre a interface. O próprio
Obsidian grava a tela:

1. `Ctrl/Cmd + P` → **Developer: Record Demo**.
2. Execute o comando **Study Book: Create a study note from a video URL**.
3. Pare a gravação e salve o arquivo como `demo.mp4` nesta pasta.

O `demo-poster.png` é a imagem exibida antes de o vídeo começar. Para
regerar o poster a partir do vídeo:

```bash
ffmpeg -y -i demo.mp4 -ss 00:00:02 -frames:v 1 demo-poster.png
```

## `logo.svg`

Ícone do plugin, usado no README, na landing page e na navegação. É um SVG
com dois retângulos que lembram um livro aberto.
