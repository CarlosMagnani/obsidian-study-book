#!/usr/bin/env python3
"""Gera o video de demonstracao da landing page.

O video usa dados REAIS: o audio de um reel do Instagram, a transcricao
produzida pelo Faster-Whisper e a analise produzida por um modelo local.

Uso:

    python make-demo.py <pasta-do-video> <saida.mp4> [saida-poster.png]

A pasta do video precisa conter audio.m4a, transcript.json e analysis.json,
no mesmo formato usado pelo projeto `study-book`.
"""

from __future__ import annotations

import json
import subprocess
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1280, 720
FPS = 30

BG = (13, 17, 23)
PANEL = (22, 27, 34)
TEXT = (230, 237, 243)
MUTED = (139, 148, 158)
ACCENT = (88, 166, 255)
GREEN = (63, 185, 80)

FONT_DIR = Path("/usr/share/fonts/truetype/liberation")
REGULAR = FONT_DIR / "LiberationSans-Regular.ttf"
BOLD = FONT_DIR / "LiberationSans-Bold.ttf"
MONO = FONT_DIR / "LiberationMono-Regular.ttf"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def text_width(draw: ImageDraw.ImageDraw, text: str, used_font: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), text, font=used_font)
    return box[2] - box[0]


def wrap(draw: ImageDraw.ImageDraw, text: str, used_font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if text_width(draw, candidate, used_font) <= width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def rounded(draw: ImageDraw.ImageDraw, box, radius=14, fill=PANEL, outline=None) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2 if outline else 0)


def frame_title(draw: ImageDraw.ImageDraw, subtitle: str, url: str) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    rounded(draw, (96, 96, 96 + 48, 96 + 48), radius=14, fill=(22, 27, 34))
    draw.text((110, 108), "SB", font=font(BOLD, 26), fill=ACCENT)

    draw.text((96, 210), "Study Book", font=font(BOLD, 76), fill=TEXT)
    draw.text((96, 310), subtitle, font=font(REGULAR, 34), fill=MUTED)

    rounded(draw, (96, 392, 96 + text_width(draw, url, font(MONO, 22)) + 40, 392 + 52), radius=10)
    draw.text((116, 404), url, font=font(MONO, 22), fill=ACCENT)

    draw.text(
        (96, 560),
        "Um reel do Instagram vira uma nota de estudo no cofre do Obsidian.",
        font=font(REGULAR, 24),
        fill=MUTED,
    )
    draw.text((96, 604), "Com a sua propria chave de API (BYOK).", font=font(REGULAR, 24), fill=MUTED)
    return image


def frame_transcript(draw: ImageDraw.ImageDraw, title: str, lines: list[str], index: int, total: int) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    draw.text((96, 78), title, font=font(BOLD, 40), fill=TEXT)

    rounded(draw, (96, 140, 96 + 220, 140 + 46), radius=12)
    draw.text((116, 152), "transcrevendo", font=font(REGULAR, 24), fill=GREEN)

    y = 240
    for line in lines:
        for piece in wrap(draw, line, font(REGULAR, 30), 980):
            draw.text((96, y), piece, font=font(REGULAR, 30), fill=TEXT)
            y += 42
        y += 12

    bar = (96, 640, 96 + 1000, 646)
    draw.rectangle(bar, fill=(35, 42, 51))
    filled = bar[0] + int((bar[2] - bar[0]) * (index / max(total, 1)))
    draw.rectangle((bar[0], bar[1], filled, bar[3]), fill=ACCENT)
    draw.text((96, 660), f"trecho {index} de {total}", font=font(REGULAR, 20), fill=MUTED)
    return image


def frame_note(draw: ImageDraw.ImageDraw, analysis: dict, provider: str, model: str) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    draw.text((96, 64), "A nota criada no cofre", font=font(BOLD, 40), fill=TEXT)

    rounded(draw, (96, 132, WIDTH - 96, HEIGHT - 116), radius=18)
    topic = analysis.get("topic", "")
    y = 164
    for piece in wrap(draw, topic, font(BOLD, 32), WIDTH - 300):
        draw.text((132, y), piece, font=font(BOLD, 32), fill=ACCENT)
        y += 42

    summary = analysis.get("summary", "")
    y += 12
    for piece in wrap(draw, summary, font(REGULAR, 26), WIDTH - 300):
        draw.text((132, y), piece, font=font(REGULAR, 26), fill=TEXT)
        y += 38

    y += 18
    draw.text((132, y), "Key points", font=font(BOLD, 24), fill=MUTED)
    y += 44
    for point in analysis.get("key_points", [])[:2]:
        draw.ellipse((136, y + 10, 146, y + 20), fill=ACCENT)
        for piece in wrap(draw, point, font(REGULAR, 24), WIDTH - 320):
            draw.text((160, y), piece, font=font(REGULAR, 24), fill=TEXT)
            y += 34
        y += 8

    draw.text(
        (132, HEIGHT - 74),
        f"Study Book · {provider} · {model}",
        font=font(MONO, 20),
        fill=MUTED,
    )
    return image


def main() -> int:
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    poster = Path(sys.argv[3]) if len(sys.argv) > 3 else output.with_suffix(".png")

    transcript = json.loads((source / "transcript.json").read_text())
    analysis = json.loads((source / "analysis.json").read_text())
    segments = transcript.get("segments", [])

    scratch = output.parent / ".frames"
    scratch.mkdir(parents=True, exist_ok=True)

    draw = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    title = frame_title(draw, "Do video para a nota de estudo", "instagram.com/reel/DeCI9l1RZKE")
    title.save(poster)
    title_path = scratch / "title.png"
    title.save(title_path)

    frames: list[Path] = [title_path]
    durations: list[float] = []
    index = 0
    for segment in segments:
        index += 1
        picture = frame_transcript(draw, "Transcricao", [segment["text"]], index, len(segments))
        path = scratch / f"transcript-{index:02d}.png"
        picture.save(path)
        frames.append(path)
        span = float(segment.get("end", 0)) - float(segment.get("start", 0))
        durations.append(max(span, 2.0))

    note = frame_note(draw, analysis, "openai", "gpt-5.6-luna")
    note_path = scratch / "note.png"
    note.save(note_path)
    frames.append(note_path)

    # O titulo fica 4 segundos, cada trecho dura o tempo real do audio e a
    # nota final fica 9 segundos.
    durations = [4.0] + durations + [9.0]
    total = sum(durations)

    concat = scratch / "concat.txt"
    lines: list[str] = []
    for path, duration in zip(frames, durations):
        lines.append(f"file '{path.resolve()}'")
        lines.append(f"duration {duration}")
    lines.append(f"file '{frames[-1].resolve()}'")
    concat.write_text("\n".join(lines) + "\n")

    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(concat),
            "-i", str(source / "audio.m4a"),
            "-filter_complex", "[0:v]fps=30,format=yuv420p[v]",
            "-map", "[v]", "-map", "1:a",
            "-c:v", "libx264", "-preset", "medium", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-af", "apad", "-t", f"{total:.2f}",
            "-movflags", "+faststart",
            str(output),
        ],
        check=True,
    )
    for path in frames:
        path.unlink(missing_ok=True)
    concat.unlink(missing_ok=True)
    scratch.rmdir()
    print(f"wrote {output} and {poster}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
