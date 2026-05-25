export type VolcengineConfig = {
  apiKey: string;
  asrEndpoint: string;
  asrResourceId: string;
  ttsEndpoint: string;
  ttsResourceId: string;
  ttsDefaultSpeaker?: string;
};

const DEFAULT_ASR_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async";
const DEFAULT_ASR_RESOURCE_ID = "volc.seedasr.sauc.duration";
const DEFAULT_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const DEFAULT_TTS_RESOURCE_ID = "seed-tts-2.0";

export class VoiceServiceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceServiceConfigError";
  }
}

export function getVolcengineConfig(): VolcengineConfig {
  const apiKey = process.env.VOLCENGINE_API_KEY?.trim();

  if (!apiKey) {
    throw new VoiceServiceConfigError("VOLCENGINE_API_KEY is required.");
  }

  return {
    apiKey,
    asrEndpoint: process.env.VOLCENGINE_ASR_ENDPOINT?.trim() || DEFAULT_ASR_ENDPOINT,
    asrResourceId: process.env.VOLCENGINE_ASR_RESOURCE_ID?.trim() || DEFAULT_ASR_RESOURCE_ID,
    ttsEndpoint: process.env.VOLCENGINE_TTS_ENDPOINT?.trim() || DEFAULT_TTS_ENDPOINT,
    ttsResourceId: process.env.VOLCENGINE_TTS_RESOURCE_ID?.trim() || DEFAULT_TTS_RESOURCE_ID,
    ttsDefaultSpeaker: process.env.VOLCENGINE_TTS_DEFAULT_SPEAKER?.trim() || undefined,
  };
}

export function createJsonError(message: string, status: number, details?: unknown) {
  return Response.json(
    {
      error: message,
      details,
    },
    { status },
  );
}
