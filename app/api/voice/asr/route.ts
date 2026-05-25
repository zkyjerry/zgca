import { createAsrSseStream, type AsrAudioFormat } from "@/lib/volcengine/asr";
import { createJsonError, getVolcengineConfig, VoiceServiceConfigError } from "@/lib/volcengine/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_FORMATS = new Set(["pcm", "wav", "ogg", "mp3"]);

export async function POST(request: Request) {
  try {
    if (!request.body) {
      return createJsonError("Audio request body is required.", 400);
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "pcm";

    if (!SUPPORTED_FORMATS.has(format)) {
      return createJsonError("Unsupported ASR audio format.", 400, {
        format,
        supported: Array.from(SUPPORTED_FORMATS),
      });
    }

    const config = getVolcengineConfig();
    const stream = createAsrSseStream(request.body, config, {
      format: format as AsrAudioFormat,
      language: url.searchParams.get("language") || "zh-CN",
      uid: url.searchParams.get("uid") || undefined,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof VoiceServiceConfigError) {
      return createJsonError(error.message, 500);
    }

    return createJsonError(error instanceof Error ? error.message : "ASR request failed.", 500);
  }
}
