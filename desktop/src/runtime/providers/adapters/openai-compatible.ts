import { ChatOpenAI } from "@langchain/openai";
import type { ProviderType } from "@ai-emotion/contracts";
import type { ChatModelLike, ProviderAdapter, ProviderRuntimeConfig } from "../provider-service";

export class OpenAICompatibleAdapter implements ProviderAdapter {
  public readonly providerType: ProviderType = "openai_compatible";

  public validate(config: ProviderRuntimeConfig): void {
    if (!config.provider_key || config.provider_key.trim() === "") {
      throw new Error("openai compatible provider requires provider_key");
    }
    if (config.model.trim() === "") {
      throw new Error("openai compatible provider requires model");
    }
    if (!config.base_url || config.base_url.trim() === "") {
      throw new Error("openai compatible provider requires base_url");
    }
  }

  public createModel(config: ProviderRuntimeConfig): ChatModelLike {
    this.validate(config);

    if (!config.api_key || config.api_key.trim() === "") {
      return new OpenAICompatibleNoAuthModel(config);
    }

    return new ChatOpenAI({
      model: config.model,
      apiKey: config.api_key,
      configuration: config.base_url ? { baseURL: config.base_url } : undefined,
      defaultHeaders: config.headers ?? undefined,
      temperature: config.temperature ?? undefined
    });
  }
}

class OpenAICompatibleNoAuthModel implements ChatModelLike {
  public constructor(private readonly config: ProviderRuntimeConfig) {}

  public async ainvoke(prompt: string): Promise<{ content: string }> {
    const response = await fetch(this.config.base_url!.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.config.headers ?? {})
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: this.config.temperature ?? undefined
      })
    });

    if (!response.ok) {
      const error = new Error(`openai-compatible upstream returned ${response.status}`);
      Object.assign(error, { status_code: response.status });
      throw error;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content: String(content) };
  }
}
