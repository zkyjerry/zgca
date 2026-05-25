import type { VolcengineConfig } from "./config";

export type TtsRequest = {
  text: string;
  speaker?: string;
  format?: "mp3" | "pcm" | "wav" | "ogg_opus";
  sampleRate?: number;
  speed?: number;
  volume?: number;
  pitch?: number;
};

type VolcengineTtsChunk = {
  code?: number;
  message?: string;
  data?: string | null;
  sentence?: unknown;
  usage?: unknown;
};

const DEFAULT_SAMPLE_RATE = 24000;

export function validateTtsRequest(input: unknown): TtsRequest {
  if (!input || typeof input !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const body = input as Partial<TtsRequest>;
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text) {
    throw new Error("text is required.");
  }

  return {
    text,
    speaker: typeof body.speaker === "string" ? body.speaker.trim() : undefined,
    format: body.format || "mp3",
    sampleRate: body.sampleRate || DEFAULT_SAMPLE_RATE,
    speed: body.speed,
    volume: body.volume,
    pitch: body.pitch,
  };
}

export async function createTtsAudioStream(
  request: TtsRequest,
  config: VolcengineConfig,
): Promise<Response> {
  const speaker = request.speaker || config.ttsDefaultSpeaker;

  if (!speaker) {
    return Response.json(
      {
        error: "speaker is required. Provide request.speaker or VOLCENGINE_TTS_DEFAULT_SPEAKER.",
      },
      { status: 400 },
    );
  }

  const upstream = await fetch(config.ttsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
      "X-Api-Resource-Id": config.ttsResourceId,
    },
    body: JSON.stringify({
      user: {
        uid: "next-voice-service",
      },
      req_params: {
        text: request.text,
        speaker,
        audio_params: {
          format: request.format || "mp3",
          sample_rate: request.sampleRate || DEFAULT_SAMPLE_RATE,
        },
        additions: buildTtsAdditions(request),
      },
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const details = await safeReadText(upstream);

    return Response.json(
      {
        error: "Volcengine TTS request failed.",
        status: upstream.status,
        details,
      },
      { status: 502 },
    );
  }

  const logId = upstream.headers.get("x-tt-logid") ?? undefined;
  const audioStream = decodeTtsJsonChunkStream(upstream.body);

  return new Response(audioStream, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForFormat(request.format || "mp3", request.sampleRate || DEFAULT_SAMPLE_RATE),
      "Cache-Control": "no-store",
      ...(logId ? { "X-Volcengine-Log-Id": logId } : {}),
    },
  });
}

function decodeTtsJsonChunkStream(input: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let pending = "";

  return input.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        pending += decoder.decode(chunk, { stream: true });
        pending = consumeJsonObjects(pending, controller);
      },
      flush(controller) {
        pending += decoder.decode();
        pending = consumeJsonObjects(pending, controller);

        if (pending.trim()) {
          emitTtsChunk(JSON.parse(pending) as VolcengineTtsChunk, controller);
        }
      },
    }),
  );
}

function consumeJsonObjects(
  input: string,
  controller: TransformStreamDefaultController<Uint8Array>,
) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let consumedUntil = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (start === -1) {
      if (char === "{") {
        start = index;
        depth = 1;
      }

      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        emitTtsChunk(JSON.parse(input.slice(start, index + 1)) as VolcengineTtsChunk, controller);
        start = -1;
        consumedUntil = index + 1;
      }
    }
  }

  return input.slice(consumedUntil);
}

function emitTtsChunk(
  chunk: VolcengineTtsChunk,
  controller: TransformStreamDefaultController<Uint8Array>,
) {
  if (chunk.code && chunk.code !== 0 && chunk.code !== 20000000) {
    throw new Error(`Volcengine TTS error ${chunk.code}: ${chunk.message || "unknown error"}`);
  }

  if (!chunk.data) {
    return;
  }

  const audio = Buffer.from(chunk.data, "base64");

  if (audio.byteLength > 0) {
    controller.enqueue(new Uint8Array(audio));
  }
}

function buildTtsAdditions(request: TtsRequest) {
  const additions: Record<string, number> = {};

  if (typeof request.speed === "number") {
    additions.speed = request.speed;
  }

  if (typeof request.volume === "number") {
    additions.volume = request.volume;
  }

  if (typeof request.pitch === "number") {
    additions.pitch = request.pitch;
  }

  return Object.keys(additions).length > 0 ? additions : undefined;
}

function contentTypeForFormat(format: TtsRequest["format"], sampleRate: number) {
  switch (format) {
    case "pcm":
      return `audio/L16; rate=${sampleRate}; channels=1`;
    case "wav":
      return "audio/wav";
    case "ogg_opus":
      return "audio/ogg";
    case "mp3":
    default:
      return "audio/mpeg";
  }
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
