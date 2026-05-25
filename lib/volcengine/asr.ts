import { gzipSync, gunzipSync } from "node:zlib";
import WebSocket from "ws";
import type { VolcengineConfig } from "./config";

const PROTOCOL_VERSION = 0b0001;
const HEADER_SIZE_WORDS = 0b0001;

const MESSAGE_TYPE_FULL_CLIENT_REQUEST = 0b0001;
const MESSAGE_TYPE_AUDIO_ONLY_REQUEST = 0b0010;
const MESSAGE_TYPE_FULL_SERVER_RESPONSE = 0b1001;
const MESSAGE_TYPE_ERROR_RESPONSE = 0b1111;

const FLAG_NO_SEQUENCE = 0b0000;
const FLAG_POS_SEQUENCE = 0b0001;
const FLAG_LAST_NO_SEQUENCE = 0b0010;
const FLAG_LAST_NEG_SEQUENCE = 0b0011;

const SERIALIZATION_NONE = 0b0000;
const SERIALIZATION_JSON = 0b0001;

const COMPRESSION_NONE = 0b0000;
const COMPRESSION_GZIP = 0b0001;

export type AsrAudioFormat = "pcm" | "wav" | "ogg" | "mp3";

export type AsrRequestOptions = {
  format?: AsrAudioFormat;
  language?: string;
  uid?: string;
};

export type AsrSseEvent =
  | { event: "partial"; data: AsrResultPayload }
  | { event: "final"; data: AsrResultPayload }
  | { event: "error"; data: { message: string; code?: number; logId?: string } }
  | { event: "done"; data: { logId?: string } };

export type AsrResultPayload = {
  text: string;
  definite: boolean;
  raw: unknown;
  logId?: string;
};

type ParsedAsrFrame =
  | {
      kind: "response";
      sequence?: number;
      isLast: boolean;
      payload: unknown;
    }
  | {
      kind: "error";
      code: number;
      message: string;
    };

type AsrWireResponse = {
  result?: {
    text?: string;
    utterances?: Array<{
      text?: string;
      definite?: boolean;
    }>;
  };
};

export function createAsrSseStream(
  audioStream: ReadableStream<Uint8Array>,
  config: VolcengineConfig,
  options: AsrRequestOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const requestId = crypto.randomUUID();
      let settled = false;
      let logId: string | undefined;

      const closeController = () => {
        if (!settled) {
          settled = true;
          controller.close();
        }
      };

      const enqueue = (event: AsrSseEvent) => {
        if (settled) {
          return;
        }

        controller.enqueue(
          encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`),
        );
      };

      const fail = (message: string, code?: number) => {
        enqueue({ event: "error", data: { message, code, logId } });
        closeController();
      };

      const ws = new WebSocket(config.asrEndpoint, {
        headers: {
          "X-Api-Key": config.apiKey,
          "X-Api-Resource-Id": config.asrResourceId,
          "X-Api-Request-Id": requestId,
          "X-Api-Sequence": "-1",
          "X-Api-Connect-Id": requestId,
        },
      });

      const reader = audioStream.getReader();

      ws.once("upgrade", (response) => {
        const header = response.headers["x-tt-logid"];
        logId = Array.isArray(header) ? header[0] : header;
      });

      ws.once("open", () => {
        ws.send(createFullClientRequest(options));
        void pipeAudioToAsr(ws, reader).catch((error: unknown) => {
          fail(error instanceof Error ? error.message : "Failed to stream ASR audio.");
          ws.close();
        });
      });

      ws.on("message", (data) => {
        try {
          const frame = parseAsrFrame(toBuffer(data));

          if (frame.kind === "error") {
            fail(frame.message, frame.code);
            ws.close();
            return;
          }

          const result = normalizeAsrResult(frame.payload, frame.isLast, logId);

          if (result.text) {
            enqueue({
              event: result.definite ? "final" : "partial",
              data: result,
            });
          }

          if (frame.isLast) {
            enqueue({ event: "done", data: { logId } });
            ws.close();
            closeController();
          }
        } catch (error) {
          fail(error instanceof Error ? error.message : "Failed to parse ASR response.");
          ws.close();
        }
      });

      ws.once("error", (error) => {
        fail(error.message);
      });

      ws.once("close", () => {
        closeController();
      });
    },
  });
}

async function pipeAudioToAsr(
  ws: WebSocket,
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  let sequence = 1;
  let sentAnyAudio = false;

  while (ws.readyState === WebSocket.OPEN) {
    const { done, value } = await reader.read();

    if (done) {
      ws.send(createAudioOnlyRequest(new Uint8Array(), sequence, true));
      return;
    }

    if (!value || value.byteLength === 0) {
      continue;
    }

    sentAnyAudio = true;
    ws.send(createAudioOnlyRequest(value, sequence, false));
    sequence += 1;
  }

  if (!sentAnyAudio) {
    throw new Error("ASR audio stream is empty.");
  }
}

function createFullClientRequest(options: AsrRequestOptions): Buffer {
  const payload = Buffer.from(
    JSON.stringify({
      user: {
        uid: options.uid || "next-voice-service",
      },
      audio: {
        format: options.format || "pcm",
        codec: "raw",
        rate: 16000,
        bits: 16,
        channel: 1,
        language: options.language || "zh-CN",
      },
      request: {
        model_name: "bigmodel",
        enable_itn: true,
        enable_ddc: false,
        enable_punc: true,
        show_utterances: true,
        result_type: "single",
      },
    }),
  );

  return packMessage({
    messageType: MESSAGE_TYPE_FULL_CLIENT_REQUEST,
    flags: FLAG_NO_SEQUENCE,
    serialization: SERIALIZATION_JSON,
    compression: COMPRESSION_GZIP,
    payload,
  });
}

function createAudioOnlyRequest(audio: Uint8Array, sequence: number, isLast: boolean): Buffer {
  return packMessage({
    messageType: MESSAGE_TYPE_AUDIO_ONLY_REQUEST,
    flags: isLast ? FLAG_LAST_NEG_SEQUENCE : FLAG_POS_SEQUENCE,
    serialization: SERIALIZATION_NONE,
    compression: COMPRESSION_GZIP,
    sequence: isLast ? -Math.abs(sequence) : sequence,
    payload: Buffer.from(audio),
  });
}

function packMessage(input: {
  messageType: number;
  flags: number;
  serialization: number;
  compression: number;
  payload: Buffer;
  sequence?: number;
}): Buffer {
  const payload = input.compression === COMPRESSION_GZIP ? gzipSync(input.payload) : input.payload;
  const header = Buffer.from([
    (PROTOCOL_VERSION << 4) | HEADER_SIZE_WORDS,
    (input.messageType << 4) | input.flags,
    (input.serialization << 4) | input.compression,
    0,
  ]);
  const sequence = hasSequence(input.flags) ? int32Buffer(input.sequence ?? 0) : Buffer.alloc(0);
  const size = uint32Buffer(payload.byteLength);

  return Buffer.concat([header, sequence, size, payload]);
}

function parseAsrFrame(buffer: Buffer): ParsedAsrFrame {
  if (buffer.byteLength < 8) {
    throw new Error("Invalid ASR frame: too short.");
  }

  const headerSize = (buffer[0] & 0x0f) * 4;
  const messageType = buffer[1] >> 4;
  const flags = buffer[1] & 0x0f;
  const serialization = buffer[2] >> 4;
  const compression = buffer[2] & 0x0f;
  let offset = headerSize;
  let sequence: number | undefined;

  if (hasSequence(flags)) {
    sequence = buffer.readInt32BE(offset);
    offset += 4;
  }

  if (messageType === MESSAGE_TYPE_ERROR_RESPONSE) {
    const code = buffer.readUInt32BE(offset);
    offset += 4;
    const errorSize = buffer.readUInt32BE(offset);
    offset += 4;
    const message = buffer.subarray(offset, offset + errorSize).toString("utf8");

    return {
      kind: "error",
      code,
      message,
    };
  }

  if (messageType !== MESSAGE_TYPE_FULL_SERVER_RESPONSE) {
    throw new Error(`Unsupported ASR message type: ${messageType}.`);
  }

  const payloadSize = buffer.readUInt32BE(offset);
  offset += 4;
  const compressedPayload = buffer.subarray(offset, offset + payloadSize);
  const payload =
    compression === COMPRESSION_GZIP ? gunzipSync(compressedPayload) : compressedPayload;

  return {
    kind: "response",
    sequence,
    isLast: flags === FLAG_LAST_NEG_SEQUENCE || sequence !== undefined && sequence < 0,
    payload: serialization === SERIALIZATION_JSON ? JSON.parse(payload.toString("utf8")) : payload,
  };
}

function normalizeAsrResult(payload: unknown, isLast: boolean, logId?: string): AsrResultPayload {
  const response = payload as AsrWireResponse;
  const utterances = response.result?.utterances ?? [];
  const lastUtterance = utterances.at(-1);
  const text = lastUtterance?.text || response.result?.text || "";
  const definite = Boolean(isLast || lastUtterance?.definite);

  return {
    text,
    definite,
    raw: payload,
    logId,
  };
}

function hasSequence(flags: number): boolean {
  return flags === FLAG_POS_SEQUENCE || flags === FLAG_LAST_NEG_SEQUENCE;
}

function int32Buffer(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value);
  return buffer;
}

function uint32Buffer(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}

function toBuffer(data: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }

  return Buffer.from(data);
}
