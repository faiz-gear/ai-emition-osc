export const QUEUE_POLICY_LATEST = "latest";
export const QUEUE_POLICY_FIFO = "fifo";

export type EmotionTask = {
  utteranceId: string;
  text: string;
  generation: number;
};

type EmotionQueuePolicy = typeof QUEUE_POLICY_LATEST | typeof QUEUE_POLICY_FIFO;

export class EmotionTaskQueue {
  private readonly queue: EmotionTask[] = [];
  private readonly waiters: Array<(task: EmotionTask) => void> = [];
  private generation = 0;
  private latestGeneration = 0;

  public constructor(
    public readonly policy: EmotionQueuePolicy,
    private readonly maxsize: number
  ) {}

  public async enqueue(
    utteranceId: string,
    text: string
  ): Promise<{ task: EmotionTask; dropped: EmotionTask[] }> {
    this.generation += 1;
    const task: EmotionTask = {
      utteranceId,
      text,
      generation: this.generation
    };
    this.latestGeneration = task.generation;

    const dropped: EmotionTask[] = [];
    if (this.policy === QUEUE_POLICY_LATEST) {
      dropped.push(...this.queue.splice(0));
      if (this.queue.length >= this.maxsize) {
        const oldest = this.queue.shift();
        if (oldest) {
          dropped.push(oldest);
        }
      }
    } else if (this.queue.length >= this.maxsize) {
      dropped.push(this.queue.shift()!);
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(task);
    } else {
      this.queue.push(task);
    }

    return { task, dropped };
  }

  public async get(): Promise<EmotionTask> {
    const queued = this.queue.shift();
    if (queued) {
      return queued;
    }

    return new Promise<EmotionTask>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  public taskDone(): void {}

  public qsize(): number {
    return this.queue.length;
  }

  public async isLatestGeneration(generation: number): Promise<boolean> {
    return generation === this.latestGeneration;
  }
}
