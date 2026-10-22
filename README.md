<p align="center">
  <img src="site/assets/logo.svg" alt="Study Book — turn a video URL into a study note in your Obsidian vault" width="220" />
</p>

<h1 align="center">Study Book</h1>

<p align="center">
  Turn any video URL into a study note in your vault — with your own API key.
</p>

<p align="center">
  <a href="https://obsidian.md/plugins?id=study-book">Install</a> ·
  <a href="https://carlosmagnani.github.io/obsidian-study-book/">Landing page</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="docs/PUBLISHING.md">Publishing guide</a>
</p>

---

Study Book downloads the audio of a video, transcribes it and writes the
study notes as a Markdown note in your vault: a summary, the key points, the
moments worth revisiting and the full transcript.

- **Your key, your bill.** The plugin has no account and no server. You
  configure the API key of the provider you already use, and the request goes
  straight from your machine to that provider.
- **Three providers, one note format.** OpenAI, Anthropic and Google Gemini
  are supported. The note looks the same no matter who wrote it.
- **Everything in the vault.** The notes are plain Markdown files with
  frontmatter, so they work with Dataview, Canvas, Templates, Sync and any
  other plugin.

## How it works

```text
video URL
  → yt-dlp downloads the audio
  → the provider transcribes the audio
  → the provider writes topic, summary, key points and moments
  → a Markdown note appears in your vault
```

## Requirements

- Obsidian 1.5 or newer, on desktop (Windows, macOS or Linux).
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available on your
  `PATH` (the plugin can also use a custom path — see the settings).
- An API key of one of the supported providers.

## Install

### From the community directory

1. Open **Settings → Community plugins → Browse**.
2. Search for **Study Book**.
3. Install it and enable it.

### Manual install

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/CarlosMagnani/obsidian-study-book/releases).
2. Create the folder `<your vault>/.obsidian/plugins/study-book/`.
3. Copy the three files into that folder.
4. Restart Obsidian and enable the plugin in **Settings → Community plugins**.

## Configure your key

1. Open **Settings → Study Book**.
2. Choose the **analysis provider** (who writes the notes).
3. Choose the **transcription provider** (who turns the audio into text).
   Anthropic has no speech to text endpoint, so transcription always uses
   OpenAI or Gemini.
4. Paste the API key of each provider you want to use. Use **Test
   connection** to check it, and **List models** to see what the provider
   offers.
5. Optionally set the folder where the notes are created.

The keys are stored in this vault only, in
`.obsidian/plugins/study-book/data.json`. They are sent to the provider you
selected, and nowhere else.

## Use it

- **Ribbon icon** or the command **Study Book: Create a study note from a
  video URL** — paste a URL and the note is written for you.
- **Study Book: Analyze a transcript that you already have** — paste a
  transcript and get the notes without downloading anything.
- **Study Book: Check the setup** — tells you if yt-dlp and the API keys were
  found.

The command **Settings → Study Book → Allowed topics** turns the topic label
into a closed list: the model must pick one of the labels you wrote.

## The note

```markdown
---
title: "How sleep works"
source: "https://www.instagram.com/reel/abc123/"
video_id: "abc123"
topic: "Sleep"
language: "en"
provider: "openai"
model: "gpt-5.6-luna"
created: "2026-10-22T10:00:00.000Z"
tags:
  - study-book
---

# How sleep works

> [!abstract] Summary
> The video explains how the sleep cycles work.

## Key points

- Deep sleep happens early in the night.
- REM sleep gets longer toward the morning.

## Moments

- **00:12** The first deep sleep block

## Source

- [How sleep works](https://www.instagram.com/reel/abc123/)
```

## Privacy

- No telemetry, no analytics, no background calls.
- The API key never leaves your machine except inside the request to the
  provider you configured.
- The audio is sent to the transcription provider and is not kept by the
  plugin: it is deleted after the run, unless **Keep the audio file** is on.
- The transcript is sent to the analysis provider, because the analysis needs
  the text.

## Development

```bash
git clone https://github.com/CarlosMagnani/obsidian-study-book.git
cd obsidian-study-book
npm install
npm run dev
```

Then copy `main.js`, `manifest.json` and `styles.css` into
`<your test vault>/.obsidian/plugins/study-book/` and reload the plugin.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and
[docs/PUBLISHING.md](docs/PUBLISHING.md) for the release and submission
checklist.

## Contributing

Issues and pull requests are welcome. Read [AGENTS.md](AGENTS.md) first: it
explains the structure of the repository and the rules the code must follow.

## License

[MIT](LICENSE) © Carlos Magnani
