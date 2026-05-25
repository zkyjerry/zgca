"use client";

import { useRef, useState } from "react";
import "./voice-debug.css";

type AsrEvent = {
  event: string;
  data: unknown;
};

type RecordingSession = {
  audioContext: AudioContext;
  mediaStream: MediaStream;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
};

const DEFAULT_TTS_TEXT = "欢迎来到 Boba House，今天的推荐是草莓芝士奶盖。";

export default function VoiceDebugClient() {
  const [isRecording, setIsRecording] = useState(false);
  const [asrStatus, setAsrStatus] = useState("待录音");
  const [asrText, setAsrText] = useState("");
  const [asrEvents, setAsrEvents] = useState<AsrEvent[]>([]);
  const [ttsText, setTtsText] = useState(DEFAULT_TTS_TEXT);
  const [speaker, setSpeaker] = useState("");
  const [ttsStatus, setTtsStatus] = useState("待合成");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recordingRef = useRef<RecordingSession | null>(null);
  const asrRequestRef = useRef<Promise<void> | null>(null);
  const pcmChunksRef = useRef<Uint8Array[]>([]);

  function cleanupRecording() {
    const session = recordingRef.current;

    if (!session) {
      return;
    }

    session.processor.onaudioprocess = null;
    session.source.disconnect();
    session.processor.disconnect();
    session.silentGain.disconnect();
    session.mediaStream.getTracks().forEach((track) => track.stop());
    void session.audioContext.close();
    recordingRef.current = null;
  }

  async function startRecording() {
    setAsrStatus("请求麦克风权限...");
    setAsrEvents([]);
    setAsrText("");
    pcmChunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("当前浏览器不支持麦克风录音");
      }

      const AudioContextCtor = getAudioContextConstructor();

      if (!AudioContextCtor) {
        throw new Error("当前浏览器不支持 Web Audio");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();

      silentGain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        const pcm = convertFloat32ToPcm16(
          event.inputBuffer.getChannelData(0),
          audioContext.sampleRate,
          16000,
        );

        if (!pcm.byteLength) {
          return;
        }

        pcmChunksRef.current.push(pcm);
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      recordingRef.current = {
        audioContext,
        mediaStream,
        source,
        processor,
        silentGain,
      };
      setIsRecording(true);
      setAsrStatus("录音中，停止后上传识别");
    } catch (error) {
      cleanupRecording();
      setAsrStatus(error instanceof Error ? error.message : "无法启动录音");
    }
  }

  function stopRecording() {
    const session = recordingRef.current;

    if (!session) {
      return;
    }

    setAsrStatus("上传录音并识别...");
    setIsRecording(false);
    cleanupRecording();

    const audio = concatChunks(pcmChunksRef.current);

    if (!audio.byteLength) {
      setAsrStatus("没有采集到音频");
      return;
    }

    asrRequestRef.current = submitRecording(audio);
  }

  async function submitRecording(audio: Uint8Array) {
    try {
      const response = await fetch("/api/voice/asr?format=pcm&language=zh-CN", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Debug-Audio-Bytes": String(audio.byteLength),
        },
        body: toArrayBuffer(audio),
      });

      if (!response.ok || !response.body) {
        const message = await readResponseMessage(response);
        throw new Error(message || `ASR failed with ${response.status}`);
      }

      setAsrStatus("识别中...");
      await readSse(response.body, (event) => {
        setAsrEvents((current) => [event, ...current].slice(0, 20));

        if (event.event === "partial" || event.event === "final") {
          const text = extractText(event.data);

          if (text) {
            setAsrText(text);
          }
        }

        if (event.event === "error") {
          setAsrStatus("识别失败");
        }

        if (event.event === "done") {
          setAsrStatus("识别完成");
        }
      });
    } catch (error) {
      setAsrStatus(formatFetchError(error, "识别请求失败"));
    }
  }

  async function synthesize() {
    setTtsStatus("合成中...");

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const response = await fetch("/api/voice/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: ttsText,
          speaker: speaker.trim() || undefined,
          format: "mp3",
          sampleRate: 24000,
        }),
      });

      if (!response.ok) {
        const message = await readResponseMessage(response);
        throw new Error(message || `TTS failed with ${response.status}`);
      }

      const audioBlob = await response.blob();
      const nextUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(nextUrl);
      setTtsStatus(`合成完成，${formatBytes(audioBlob.size)}`);
    } catch (error) {
      setTtsStatus(formatFetchError(error, "合成请求失败"));
    }
  }

  return (
    <main className="voiceDebugShell">
      <section className="voiceDebugHeader">
        <div>
          <span className="voiceDebugKicker">TEMP VOICE LAB</span>
          <h1>语音模块调试台</h1>
        </div>
        <p>用于临时验证 `/api/voice/asr` 与 `/api/voice/tts`，后续业务模块可以直接复用接口。</p>
      </section>

      <section className="voiceDebugGrid">
        <article className="voicePanel asrPanel">
          <div className="panelTitleRow">
            <div>
              <span className="panelIndex">01</span>
              <h2>流式语音识别</h2>
            </div>
            <span className={isRecording ? "statusPill live" : "statusPill"}>{asrStatus}</span>
          </div>

          <div className="meterStrip" aria-hidden="true">
            {Array.from({ length: 28 }, (_, index) => (
              <span key={index} className={isRecording ? "meterBar active" : "meterBar"} />
            ))}
          </div>

          <div className="buttonRow">
            <button type="button" className="primaryButton" onClick={startRecording} disabled={isRecording}>
              开始录音
            </button>
            <button type="button" className="secondaryButton" onClick={stopRecording} disabled={!isRecording}>
              停止并识别
            </button>
          </div>

          <div className="resultBox">
            <span>识别文本</span>
            <p>{asrText || "暂无识别结果"}</p>
          </div>

          <div className="eventLog">
            <span>事件流</span>
            <pre>{asrEvents.length ? JSON.stringify(asrEvents, null, 2) : "等待 SSE 事件..."}</pre>
          </div>
        </article>

        <article className="voicePanel ttsPanel">
          <div className="panelTitleRow">
            <div>
              <span className="panelIndex">02</span>
              <h2>语音合成</h2>
            </div>
            <span className="statusPill">{ttsStatus}</span>
          </div>

          <label className="fieldStack">
            <span>合成文本</span>
            <textarea value={ttsText} onChange={(event) => setTtsText(event.target.value)} rows={6} />
          </label>

          <label className="fieldStack">
            <span>Speaker 覆盖值</span>
            <input
              value={speaker}
              onChange={(event) => setSpeaker(event.target.value)}
              placeholder="留空则使用 VOLCENGINE_TTS_DEFAULT_SPEAKER"
            />
          </label>

          <div className="buttonRow">
            <button type="button" className="primaryButton" onClick={synthesize} disabled={!ttsText.trim()}>
              合成语音
            </button>
          </div>

          <div className="audioDock">
            {audioUrl ? <audio src={audioUrl} controls /> : <span>合成完成后会出现播放器</span>}
          </div>
        </article>
      </section>
    </main>
  );
}

function getAudioContextConstructor() {
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

function convertFloat32ToPcm16(source: Float32Array, fromRate: number, toRate: number) {
  const resampled = resampleLinear(source, fromRate, toRate);
  const pcm = new Int16Array(resampled.length);

  for (let index = 0; index < resampled.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, resampled[index]));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return new Uint8Array(pcm.buffer);
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) {
    return input;
  }

  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const weight = position - left;
    output[index] = input[left] * (1 - weight) + input[right] * weight;
  }

  return output;
}

function concatChunks(chunks: Uint8Array[]) {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const result = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.slice().buffer;
}

async function readSse(stream: ReadableStream<Uint8Array>, onEvent: (event: AsrEvent) => void) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    const events = pending.split("\n\n");
    pending = events.pop() || "";

    for (const rawEvent of events) {
      const event = parseSseEvent(rawEvent);

      if (event) {
        onEvent(event);
      }
    }
  }
}

function parseSseEvent(raw: string): AsrEvent | null {
  const lines = raw.split(/\r?\n/);
  const event = lines.find((line) => line.startsWith("event: "))?.slice(7).trim() || "message";
  const dataLine = lines.find((line) => line.startsWith("data: "));

  if (!dataLine) {
    return null;
  }

  try {
    return {
      event,
      data: JSON.parse(dataLine.slice(6)),
    };
  } catch {
    return {
      event,
      data: dataLine.slice(6),
    };
  }
}

function extractText(data: unknown) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const maybeText = (data as { text?: unknown }).text;
  return typeof maybeText === "string" ? maybeText : "";
}

async function readResponseMessage(response: Response) {
  try {
    const text = await response.text();

    if (!text) {
      return "";
    }

    try {
      const parsed = JSON.parse(text) as { error?: unknown; details?: unknown };
      const error = typeof parsed.error === "string" ? parsed.error : "";
      const details =
        typeof parsed.details === "string"
          ? parsed.details
          : parsed.details
            ? JSON.stringify(parsed.details)
            : "";

      return [error, details].filter(Boolean).join(": ");
    } catch {
      return text;
    }
  } catch {
    return "";
  }
}

function formatFetchError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (/fetch/i.test(error.message)) {
    return `${fallback}，请确认开发服务器和语音接口可用`;
  }

  return error.message || fallback;
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  return `${(size / 1024).toFixed(1)} KB`;
}
