import type { EmotionDimensions, EmotionResult } from "@ai-emotion/contracts";
import { z } from "zod";
import type { ChatModelLike } from "../providers/provider-service";

const EMOTION_KEYS = [
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation"
] as const;

const emotionResultSchema = z.object({
  dimensions: z
    .object({
      joy: z.number().default(0),
      trust: z.number().default(0),
      fear: z.number().default(0),
      surprise: z.number().default(0),
      sadness: z.number().default(0),
      disgust: z.number().default(0),
      anger: z.number().default(0),
      anticipation: z.number().default(0)
    })
    .default({}),
  dominant_emotion: z.string().default("neutral"),
  brief_explanation: z.string().default("")
});

type ProviderServiceLike = {
  getActiveChatModel(): Promise<ChatModelLike>;
};

type EmotionServiceOptions = {
  providerService: ProviderServiceLike;
  promptTemplate: string;
};

export class EmotionService {
  public constructor(private readonly options: EmotionServiceOptions) {}

  public async analyzeText(text: string): Promise<EmotionResult> {
    const model = await this.options.providerService.getActiveChatModel();
    const prompt = interpolatePrompt(this.options.promptTemplate, text);

    try {
      const structuredResult = await invokeStructured(model, prompt);
      if (structuredResult) {
        return normalizeEmotionPayload(structuredResult);
      }
    } catch {
      // Fallback to raw JSON extraction below.
    }

    const response = await model.ainvoke(prompt);
    const payload = extractFirstJsonObject(stringifyResponseContent(response));
    if (!payload) {
      throw new Error("LLM output did not contain parsable JSON");
    }

    return normalizeEmotionPayload(payload);
  }
}

export function interpolatePrompt(template: string, userText: string): string {
  return template
    .replaceAll("{{USER_TEXT}}", userText)
    .replaceAll("{input_text}", userText)
    .replaceAll("<用户输入文本>", userText);
}

export function normalizeEmotionPayload(payload: Record<string, unknown>): EmotionResult {
  const rawDimensions = isRecord(payload.dimensions)
    ? payload.dimensions
    : isRecord(payload.emotions)
      ? payload.emotions
      : {};

  const dimensions = Object.fromEntries(
    EMOTION_KEYS.map((key) => [key, clampToUnit(rawDimensions[key])])
  ) as EmotionDimensions;

  const requestedDominant = typeof payload.dominant_emotion === "string" ? payload.dominant_emotion : null;
  const dominant_emotion =
    requestedDominant && (requestedDominant === "neutral" || EMOTION_KEYS.includes(requestedDominant as never))
      ? requestedDominant
      : deriveDominantEmotion(dimensions);

  return {
    dimensions,
    dominant_emotion,
    brief_explanation:
      typeof payload.brief_explanation === "string"
        ? payload.brief_explanation.trim().slice(0, 100)
        : ""
  };
}

export function extractFirstJsonObject(text: string): Record<string, unknown> | null {
  const fencedMatches = [...text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g)];
  for (const match of fencedMatches) {
    const candidate = safeParseObject(match[1]);
    if (candidate) {
      return candidate;
    }
  }

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{") {
      continue;
    }
    const candidate = rawDecodeObject(text, index);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function invokeStructured(
  model: ChatModelLike,
  prompt: string
): Promise<Record<string, unknown> | null> {
  if (typeof model.withStructuredOutput !== "function") {
    return null;
  }

  const structuredModel = model.withStructuredOutput(emotionResultSchema);
  const structured = await structuredModel.ainvoke(prompt);
  if (!structured) {
    return null;
  }

  if (typeof structured === "object" && "dimensions" in structured) {
    return structured as Record<string, unknown>;
  }

  return null;
}

function stringifyResponseContent(response: unknown): string {
  if (response && typeof response === "object" && "content" in response) {
    const content = (response as { content: unknown }).content;
    if (Array.isArray(content)) {
      return content.map(stringifyContentPart).join("\n");
    }
    return String(content);
  }

  return String(response);
}

function stringifyContentPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }

  if (part && typeof part === "object") {
    if ("text" in part && typeof (part as { text?: unknown }).text === "string") {
      return (part as { text: string }).text;
    }
    if ("content" in part && typeof (part as { content?: unknown }).content === "string") {
      return (part as { content: string }).content;
    }
  }

  return String(part);
}

function safeParseObject(text: string | undefined): Record<string, unknown> | null {
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function rawDecodeObject(text: string, startIndex: number): Record<string, unknown> | null {
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
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
        return safeParseObject(text.slice(startIndex, index + 1));
      }
    }
  }

  return null;
}

function deriveDominantEmotion(dimensions: EmotionDimensions): string {
  let winner: keyof EmotionDimensions = "joy";
  for (const key of EMOTION_KEYS) {
    if (dimensions[key] > dimensions[winner]) {
      winner = key;
    }
  }

  return dimensions[winner] < 0.3 ? "neutral" : winner;
}

function clampToUnit(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  if (numeric >= 1) {
    return 1;
  }
  return numeric;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
