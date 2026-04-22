// Fully on-device AI using WebLLM (WebGPU). Works offline once model is cached.
import {
  CreateMLCEngine,
  type MLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
} from "@mlc-ai/web-llm";

// Small, mobile-friendly model. ~1GB, cached in OPFS / IndexedDB after first load.
export const LOCAL_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

let enginePromise: Promise<MLCEngine> | null = null;
let lastProgress: InitProgressReport | null = null;
const progressListeners = new Set<(p: InitProgressReport) => void>();

export type LocalMsg = { role: "user" | "assistant" | "system"; content: string };

export const onProgress = (cb: (p: InitProgressReport) => void) => {
  progressListeners.add(cb);
  if (lastProgress) cb(lastProgress);
  return () => progressListeners.delete(cb);
};

export const isWebGPUSupported = () =>
  typeof navigator !== "undefined" && "gpu" in navigator;

export const getEngine = (): Promise<MLCEngine> => {
  if (enginePromise) return enginePromise;
  if (!isWebGPUSupported()) {
    return Promise.reject(
      new Error(
        "Your device doesn't support on-device AI (WebGPU). Try Chrome on Android or a recent iOS browser."
      )
    );
  }
  enginePromise = CreateMLCEngine(LOCAL_MODEL_ID, {
    initProgressCallback: (p) => {
      lastProgress = p;
      progressListeners.forEach((cb) => cb(p));
    },
  });
  return enginePromise;
};

// Stream a chat completion using the local model.
export async function streamLocalChat(
  messages: LocalMsg[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const engine = await getEngine();
  const chunks = await engine.chat.completions.create({
    messages: messages as ChatCompletionMessageParam[],
    stream: true,
    temperature: 0.8,
  });
  for await (const chunk of chunks) {
    if (signal?.aborted) break;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) onDelta(delta);
  }
}
