import { describe, expect, test } from "vitest";
import { EmotionService } from "../../../runtime/emotion/emotion-service";
import { OscService, type OscTransport } from "../../../runtime/osc/osc-service";
import type { ChatModelLike } from "../../../runtime/providers/provider-service";

type StructuredInvoker = {
  ainvoke(prompt: string): Promise<unknown>;
};

class FakeStructuredModel implements StructuredInvoker {
  public calls = 0;

  public constructor(private readonly result: unknown) {}

  async ainvoke(_prompt: string): Promise<unknown> {
    this.calls += 1;
    return this.result;
  }
}

class FakeChatModel implements ChatModelLike {
  public rawCalls = 0;
  public structuredCalls = 0;

  public constructor(
    private readonly options: {
      structuredResult?: unknown;
      structuredError?: Error;
      rawResult: unknown;
    }
  ) {}

  withStructuredOutput(_schema: unknown): StructuredInvoker {
    this.structuredCalls += 1;
    if (this.options.structuredError) {
      throw this.options.structuredError;
    }
    return new FakeStructuredModel(this.options.structuredResult);
  }

  async ainvoke(_prompt: string): Promise<unknown> {
    this.rawCalls += 1;
    return this.options.rawResult;
  }
}

class FakeProviderService {
  public calls = 0;

  public constructor(private readonly model: ChatModelLike) {}

  async getActiveChatModel(): Promise<ChatModelLike> {
    this.calls += 1;
    return this.model;
  }
}

describe("emotion service", () => {
  test("prefers structured output when the model supports it", async () => {
    const model = new FakeChatModel({
      structuredResult: {
        dimensions: {
          joy: 0.9,
          trust: 0.2,
          fear: 0.1,
          surprise: 0.1,
          sadness: 0.1,
          disgust: 0.1,
          anger: 0.1,
          anticipation: 0.2
        },
        dominant_emotion: "joy",
        brief_explanation: "structured path"
      },
      rawResult: {
        content: "{\"dominant_emotion\":\"anger\"}"
      }
    });
    const providerService = new FakeProviderService(model);
    const service = new EmotionService({
      providerService,
      promptTemplate: "Analyze {{USER_TEXT}}"
    });

    const result = await service.analyzeText("hello");

    expect(providerService.calls).toBe(1);
    expect(model.structuredCalls).toBe(1);
    expect(model.rawCalls).toBe(0);
    expect(result.dominant_emotion).toBe("joy");
  });

  test("falls back to JSON extraction when structured output fails", async () => {
    const model = new FakeChatModel({
      structuredError: new Error("structured output unavailable"),
      rawResult: {
        content: [
          "model thoughts",
          "```json",
          JSON.stringify({
            dimensions: {
              joy: 0.2,
              trust: 0.3,
              fear: 0.1,
              surprise: 0.1,
              sadness: 0.1,
              disgust: 0.1,
              anger: 1.8,
              anticipation: 0.2
            },
            dominant_emotion: "anger",
            brief_explanation: "fallback path"
          }),
          "```"
        ].join("\n")
      }
    });
    const service = new EmotionService({
      providerService: new FakeProviderService(model),
      promptTemplate: "Analyze {input_text}"
    });

    const result = await service.analyzeText("hello");

    expect(model.structuredCalls).toBe(1);
    expect(model.rawCalls).toBe(1);
    expect(result.dominant_emotion).toBe("anger");
    expect(result.dimensions.anger).toBe(1);
  });
});

describe("osc service", () => {
  test("swallows transport exceptions without crashing the runtime", () => {
    let attempts = 0;
    const transport: OscTransport = {
      send(_address, _payload) {
        attempts += 1;
        throw new Error("socket unavailable");
      },
      close() {}
    };
    const service = new OscService({
      host: "127.0.0.1",
      port: 9000,
      transport
    });

    expect(() =>
      service.sendEmotion({
        joy: 0.1,
        trust: 0.2,
        fear: 0.3,
        surprise: 0.4,
        sadness: 0.5,
        disgust: 0.6,
        anger: 0.7,
        anticipation: 0.8
      })
    ).not.toThrow();
    expect(attempts).toBe(1);
  });
});
