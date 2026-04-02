import { Client } from "node-osc";
import type { EmotionDimensions } from "@ai-emotion/contracts";

export type OscTransport = {
  send(address: string, payload: unknown): void | Promise<void>;
  close(): void | Promise<void>;
};

type OscServiceOptions = {
  host: string;
  port: number;
  transport?: OscTransport;
};

export class OscService {
  private readonly transport: OscTransport;

  public constructor(options: OscServiceOptions) {
    this.transport =
      options.transport ??
      new NodeOscTransport({
        host: options.host,
        port: options.port
      });
  }

  public sendEmotion(dimensions: EmotionDimensions): void {
    try {
      void this.transport.send("/emotion", [dimensions]);
    } catch {
      return;
    }
  }

  public close(): void {
    try {
      void this.transport.close();
    } catch {
      return;
    }
  }
}

class NodeOscTransport implements OscTransport {
  private readonly client: Client;

  public constructor(options: { host: string; port: number }) {
    this.client = new Client(options.host, options.port);
  }

  public send(address: string, payload: unknown): void {
    void this.client.send(address, payload);
  }

  public close(): void {
    void this.client.close();
  }
}
