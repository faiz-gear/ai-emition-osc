export function createCommandTracker() {
  let latestSequenceId = 0;

  return {
    next() {
      latestSequenceId += 1;
      return latestSequenceId;
    },
    isLatest(sequenceId: number) {
      return sequenceId === latestSequenceId;
    },
  };
}

export async function withCommandTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms = 10_000,
): Promise<T> {
  const controller = new AbortController();

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new Error(`command timeout after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
