import type { EmotionResult } from "@ai-emotion/contracts";
import type { OscService } from "../osc/osc-service";
import type { EmotionService } from "./emotion-service";
import { QUEUE_POLICY_LATEST, type EmotionTaskQueue } from "./emotion-queue";

type EmotionWorkerOptions = {
  queue: EmotionTaskQueue;
  service: EmotionService;
  osc: OscService;
  onStarted?: (input: { utteranceId: string }) => Promise<void> | void;
  onResult?: (input: { utteranceId: string; result: EmotionResult }) => Promise<void> | void;
  onFailed?: (input: { utteranceId: string; error: unknown }) => Promise<void> | void;
  onSuperseded?: (input: { utteranceId: string }) => Promise<void> | void;
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
        if (await this.isSuperseded(task.generation)) {
          await this.options.onSuperseded?.({
            utteranceId: task.utteranceId
          });
          continue;
        }

        await this.options.onStarted?.({
          utteranceId: task.utteranceId
        });
        const result = await this.options.service.analyzeText(task.text);
        if (await this.isSuperseded(task.generation)) {
          await this.options.onSuperseded?.({
            utteranceId: task.utteranceId
          });
          continue;
        }
        await this.options.osc.sendEmotion(result.dimensions);
        if (await this.isSuperseded(task.generation)) {
          await this.options.onSuperseded?.({
            utteranceId: task.utteranceId
          });
          continue;
        }
        await this.options.onResult?.({
          utteranceId: task.utteranceId,
          result
        });
      } catch (error) {
        await this.options.onFailed?.({
          utteranceId: task.utteranceId,
          error
        });
        continue;
      } finally {
        this.options.queue.taskDone();
      }
    }
  }

  private async isSuperseded(generation: number): Promise<boolean> {
    if (this.options.queue.policy !== QUEUE_POLICY_LATEST) {
      return false;
    }

    return !(await this.options.queue.isLatestGeneration(generation));
  }
}
