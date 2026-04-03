import { ChatOpenAI } from "@langchain/openai";
import type { ProviderType } from "@ai-emotion/contracts";
import type { ProviderAdapter, ProviderRuntimeConfig } from "../provider-service";

export class OpenAIAdapter implements ProviderAdapter {
  public readonly providerType: ProviderType = "openai";

  public validate(config: ProviderRuntimeConfig): void {
    if (config.model.trim() === "") {
      throw new Error("openai provider requires model");
    }
    if (!config.api_key || config.api_key.trim() === "") {
      throw new Error("openai provider requires api_key");
    }
  }

  public createModel(config: ProviderRuntimeConfig): ChatOpenAI {
    this.validate(config);

    return new ChatOpenAI({
      model: config.model,
      apiKey: config.api_key,
      configuration: config.base_url ? { baseURL: config.base_url } : undefined,
      defaultHeaders: config.headers ?? undefined,
      temperature: config.temperature ?? undefined
    });
  }
}
