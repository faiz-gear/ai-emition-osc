import { ChatOllama } from "@langchain/ollama";
import type { ProviderType } from "@ai-emotion/contracts";
import type { ProviderAdapter, ProviderRuntimeConfig } from "../provider-service";

export class OllamaAdapter implements ProviderAdapter {
  public readonly providerType: ProviderType = "ollama";

  public validate(config: ProviderRuntimeConfig): void {
    if (config.model.trim() === "") {
      throw new Error("ollama provider requires model");
    }
  }

  public createModel(config: ProviderRuntimeConfig): ChatOllama {
    this.validate(config);

    return new ChatOllama({
      model: config.model,
      baseUrl: config.base_url ?? "http://127.0.0.1:11434",
      temperature: config.temperature ?? undefined
    });
  }
}
