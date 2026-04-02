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
  private readonly waiters: Array<(task: EmotionTask | null) => void> = [];
  private readonly spaceWaiters: Array<() => void> = [];
  private closed = false;
  private generation = 0;
  private latestGeneration = 0;
  private unfinishedTasks = 0;

  public constructor(
    public readonly policy: EmotionQueuePolicy,
    private readonly maxsize: number
  ) {}

  public async enqueue(
    utteranceId: string,
    text: string
  ): Promise<{ task: EmotionTask; dropped: EmotionTask[] }> {
    if (this.closed) {
      throw new Error("Emotion queue is closed");
    }

    this.generation += 1;
    const task: EmotionTask = {
      utteranceId,
      text,
      generation: this.generation
    };
    this.latestGeneration = task.generation;
    this.unfinishedTasks += 1;

    const dropped: EmotionTask[] = [];
    if (this.policy === QUEUE_POLICY_LATEST) {
      dropped.push(...this.queue.splice(0));
      if (this.queue.length >= this.maxsize) {
        const oldest = this.queue.shift();
        if (oldest) {
          dropped.push(oldest);
        }
      }
    } else {
      while (this.queue.length >= this.maxsize && this.waiters.length === 0 && !this.closed) {
        await new Promise<void>((resolve) => {
          this.spaceWaiters.push(resolve);
        });
      }
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(task);
    } else {
      this.queue.push(task);
    }

    return { task, dropped };
  }

  public async get(): Promise<EmotionTask | null> {
    const queued = this.queue.shift();
    if (queued) {
      this.spaceWaiters.shift()?.();
      return queued;
    }

    if (this.closed) {
      return null;
    }

    return new Promise<EmotionTask | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  public taskDone(): void {
    if (this.unfinishedTasks > 0) {
      this.unfinishedTasks -= 1;
    }
  }

  public qsize(): number {
    return this.queue.length;
  }

  public async isLatestGeneration(generation: number): Promise<boolean> {
    return generation === this.latestGeneration;
  }

  public close(): void {
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.(null);
    }
    while (this.spaceWaiters.length > 0) {
      this.spaceWaiters.shift()?.();
    }
  }
}
