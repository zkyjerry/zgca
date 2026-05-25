# Boba House

A small 2D pixel-style milk tea shop game built with Next.js and Phaser 3.

## Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Controls

- `WASD` or arrow keys: move
- `E`: interact with nearby objects

## Notes

The prototype uses generated pixel textures so it runs without external asset downloads. Replace the generated texture keys listed in `public/assets/credits.md` when a licensed tileset or sprite pack is selected.

## Voice Service

Set the Volcengine credentials in `.env.local` using `.env.example` as a template.

### ASR

`POST /api/voice/asr`

- Request body: raw audio stream, default `pcm` / `16000Hz` / `16bit` / mono.
- Query: `format=pcm|wav|ogg|mp3`, `language=zh-CN`.
- Response: `text/event-stream` with `partial`, `final`, `error`, and `done` events.

### TTS

`POST /api/voice/tts`

```json
{
  "text": "欢迎来到 Boba House",
  "speaker": "zh_female_shuangkuaisisi_moon_bigtts",
  "format": "mp3",
  "sampleRate": 24000
}
```

The response is an audio byte stream, defaulting to `audio/mpeg`.
