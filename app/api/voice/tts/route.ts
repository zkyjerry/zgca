import { createJsonError, getVolcengineConfig, VoiceServiceConfigError } from "@/lib/volcengine/config";
import { createTtsAudioStream, validateTtsRequest } from "@/lib/volcengine/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const ttsRequest = validateTtsRequest(payload);
    const config = getVolcengineConfig();

    return await createTtsAudioStream(ttsRequest, config);
  } catch (error) {
    if (error instanceof VoiceServiceConfigError) {
      return createJsonError(error.message, 500);
    }

    return createJsonError(error instanceof Error ? error.message : "TTS request failed.", 400);
  }
}
