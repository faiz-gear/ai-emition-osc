import type { EmotionResult } from "@ai-emotion/contracts";
import type { OscService } from "../osc/osc-service";
import type { EmotionService } from "./emotion-service";
import type { EmotionTaskQueue } from "./emotion-queue";

type EmotionWorkerOptions = {
  queue: EmotionTaskQueue;
  service: EmotionService;
  osc: OscService;
  onResult?: (input: { utteranceId: string; result: EmotionResult }) => Promise<void> | void;
};

export class EmotionWorker {
  private running = false;
  private loopPromise: Promise<void> | null = null;

  public constructor(private readonly options: EmotionWorkerOptions) {}

  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.loopPromise = this.runLoop();
  }

  public async stop(): Promise<void> {
    this.running = false;
    this.options.queue.close();
    await this.loopPromise;
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      const task = await this.options.queue.get();
      if (!task) {
        return;
      }

      try {
        const result = await this.options.service.analyzeText(task.text);
        await this.options.osc.sendEmotion(result.dimensions);
        await this.options.onResult?.({
          utteranceId: task.utteranceId,
          result
        });
      } catch {
        continue;
      } finally {
        this.options.queue.taskDone();
      }
    }
  }
}
