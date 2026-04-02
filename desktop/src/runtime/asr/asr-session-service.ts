import type {
  EmotionResult,
  RecognitionStrategy,
  RuntimeEvent,
  RuntimeSnapshot,
  Utterance
} from "@ai-emotion/contracts";
import type { EmotionTaskQueue } from "../emotion/emotion-queue";
import {
  createCaptureFrameSource,
  type CaptureFrameSource
} from "./capture-frame-source";
import {
  AsrWorkerError,
  createAsrWorker,
  type FinalTranscriptEvent,
  type PcmFrame,
  type WhisperRunner
} from "./asr-worker";

type InstalledModel = {
  modelId: string;
  active: boolean;
};

type AsrSessionModelStore = {
  getModelsRootPath(): string;
  listInstalledModels(): Promise<InstalledModel[]>;
  getActiveModelId(): Promise<string | null>;
  activateModel(modelId: string): Promise<unknown>;
};

type RuntimeStateBus = {
  getSnapshot(): RuntimeSnapshot;
  setSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot;
  publish(event: RuntimeEvent): void;
};

export type AsrSessionService = {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  handleCapturePcmFrame(frame: PcmFrame): Promise<void>;
  switchModel(modelId: string): Promise<void>;
  updateRecognitionStrategy(input: RecognitionStrategy): Promise<RecognitionStrategy>;
  getRecognitionStrategy(): RecognitionStrategy;
  isListening(): boolean;
  handleEmotionStarted(input: { utteranceId: string }): void;
  handleEmotionResult(input: { utteranceId: string; result: EmotionResult }): void;
  handleEmotionFailure(input: { utteranceId: string }): void;
  handleEmotionSuperseded(input: { utteranceId: string }): void;
};

type AsrSessionServiceOptions = {
  modelStore: AsrSessionModelStore;
  captureSource?: CaptureFrameSource;
  emotionQueue: EmotionTaskQueue;
  runtime: RuntimeStateBus;
  runner?: WhisperRunner;
  now?: () => string;
  nowMs?: () => number;
};

type SessionPhase = "idle" | "starting" | "listening" | "stopping";

export function createAsrSessionService(
  options: AsrSessionServiceOptions
): AsrSessionService {
  const now = options.now ?? (() => new Date().toISOString());
  const nowMs = options.nowMs ?? (() => Date.now());
  const captureSource = options.captureSource ?? createCaptureFrameSource();
  const emotionStartedAt = new Map<string, number>();
  let phase: SessionPhase = "idle";
  let transition: Promise<void> | null = null;
  let unsubscribeCaptureSource: (() => void) | null = null;
  let cancelPendingStart = false;

  const asrWorker = createAsrWorker({
    modelStore: options.modelStore,
    runner: options.runner,
    onFinalTranscript: handleFinalTranscript
  });

  return {
    async startListening() {
      if (phase === "listening") {
        ensureCaptureSubscription();
        return;
      }

      if (phase === "starting") {
        await transition;
        return;
      }

      if (phase === "stopping") {
        await transition;
        await this.startListening();
        return;
      }

      transition = (async () => {
        phase = "starting";
        await asrWorker.startListening();
        if (cancelPendingStart) {
          cancelPendingStart = false;
          await asrWorker.stopListening();
          phase = "idle";
          return;
        }
        ensureCaptureSubscription();
        phase = "listening";
        publishListeningStatus(true);
      })().finally(() => {
        transition = null;
        if (phase === "starting") {
          phase = asrWorker.isListening() ? "listening" : "idle";
        }
      });

      await transition;
    },
    async stopListening() {
      if (phase === "idle") {
        detachCaptureSubscription();
        publishListeningStatus(false);
        return;
      }

      if (phase === "stopping") {
        await transition;
        return;
      }

      if (phase === "starting") {
        cancelPendingStart = true;
        await transition;
        if (phase !== "listening") {
          return;
        }
      }

      transition = (async () => {
        phase = "stopping";
        detachCaptureSubscription();
        await asrWorker.stopListening();
        phase = "idle";
        publishListeningStatus(false);
      })().finally(() => {
        transition = null;
        if (phase === "stopping") {
          phase = asrWorker.isListening() ? "listening" : "idle";
        }
      });

      await transition;
    },
    async handleCapturePcmFrame(frame) {
      await captureSource.dispatch(frame);
    },
    async switchModel(modelId) {
      await asrWorker.switchModel(modelId);
    },
    async updateRecognitionStrategy(input) {
      if (phase !== "idle") {
        throw new AsrWorkerError(
          "ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING",
          "Recognition strategy changes are disabled while listening"
        );
      }
      return asrWorker.updateRecognitionStrategy(input);
    },
    getRecognitionStrategy() {
      return asrWorker.getRecognitionStrategy();
    },
    isListening() {
      return asrWorker.isListening();
    },
    handleEmotionStarted({ utteranceId }) {
      emotionStartedAt.set(utteranceId, nowMs());
      const utterance = updateUtterance(utteranceId, (current) => ({
        ...current,
        emotion_status: "processing"
      }));
      options.runtime.publish({
        type: "emotion:started",
        payload: { utteranceId }
      });
      if (utterance) {
        options.runtime.publish({
          type: "runtime:utterance",
          payload: utterance
        });
      }
    },
    handleEmotionResult({ utteranceId, result }) {
      const latencyStartedAt = emotionStartedAt.get(utteranceId);
      emotionStartedAt.delete(utteranceId);
      const utterance = updateUtterance(utteranceId, (current) => ({
        ...current,
        emotion: result,
        emotion_status: "done",
        latency_ms:
          latencyStartedAt === undefined ? current.latency_ms ?? null : nowMs() - latencyStartedAt
      }));
      options.runtime.publish({
        type: "emotion:result",
        payload: {
          utteranceId,
          result
        }
      });
      if (utterance) {
        options.runtime.publish({
          type: "runtime:utterance",
          payload: utterance
        });
      }
    },
    handleEmotionFailure({ utteranceId }) {
      emotionStartedAt.delete(utteranceId);
      const utterance = updateUtterance(utteranceId, (current) => ({
        ...current,
        emotion_status: "error"
      }));
      if (utterance) {
        options.runtime.publish({
          type: "runtime:utterance",
          payload: utterance
        });
      }
    },
    handleEmotionSuperseded({ utteranceId }) {
      emotionStartedAt.delete(utteranceId);
      const utterance = updateUtterance(
        utteranceId,
        (current) => ({
          ...current,
          emotion_status: "dropped"
        }),
        (snapshot) => {
          snapshot.metrics.emotion_stale_total =
            (snapshot.metrics.emotion_stale_total ?? 0) + 1;
        }
      );
      if (utterance) {
        options.runtime.publish({
          type: "runtime:utterance",
          payload: utterance
        });
      }
    }
  };

  async function handleFinalTranscript(event: FinalTranscriptEvent): Promise<void> {
    const utterance = createQueuedUtterance(event);
    commitSnapshot((snapshot) => {
      snapshot.utterances = [...snapshot.utterances, utterance];
      snapshot.metrics.utterances_total = snapshot.utterances.length;
      snapshot.metrics.emotion_queue_depth = options.emotionQueue.qsize();
    });
    options.runtime.publish({
      type: "runtime:utterance",
      payload: utterance
    });

    try {
      const { dropped } = await options.emotionQueue.enqueue(utterance.id, event.text);
      if (dropped.length > 0) {
        for (const droppedTask of dropped) {
          const droppedUtterance = updateUtterance(droppedTask.utteranceId, (current) => ({
            ...current,
            emotion_status: "dropped"
          }));
          if (droppedUtterance) {
            options.runtime.publish({
              type: "runtime:utterance",
              payload: droppedUtterance
            });
          }
        }

        commitSnapshot((snapshot) => {
          snapshot.metrics.emotion_dropped_total =
            (snapshot.metrics.emotion_dropped_total ?? 0) + dropped.length;
        });
      }

      commitSnapshot((snapshot) => {
        snapshot.metrics.emotion_queue_depth = options.emotionQueue.qsize();
      });
    } catch {
      const erroredUtterance = updateUtterance(utterance.id, (current) => ({
        ...current,
        emotion_status: "error"
      }));
      if (erroredUtterance) {
        options.runtime.publish({
          type: "runtime:utterance",
          payload: erroredUtterance
        });
      }
    }
  }

  function publishListeningStatus(listening: boolean): void {
    commitSnapshot((snapshot) => {
      snapshot.status.listening = listening;
    });
    options.runtime.publish({
      type: "session:status",
      payload: { listening }
    });
  }

  function ensureCaptureSubscription(): void {
    if (unsubscribeCaptureSource) {
      return;
    }

    unsubscribeCaptureSource = captureSource.subscribe(async (frame) => {
      await asrWorker.handlePcmFrame(frame);
    });
  }

  function detachCaptureSubscription(): void {
    unsubscribeCaptureSource?.();
    unsubscribeCaptureSource = null;
  }

  function createQueuedUtterance(event: FinalTranscriptEvent): Utterance {
    const timestamp = now();
    return {
      id: event.segmentId,
      started_at: timestamp,
      ended_at: timestamp,
      final_text: event.text,
      partial_text: null,
      emotion: null,
      emotion_status: "queued",
      latency_ms: null
    };
  }

  function updateUtterance(
    utteranceId: string,
    updater: (current: Utterance) => Utterance,
    afterUpdate?: (snapshot: RuntimeSnapshot) => void
  ): Utterance | null {
    let updatedUtterance: Utterance | null = null;
    commitSnapshot((snapshot) => {
      snapshot.utterances = snapshot.utterances.map((utterance) => {
        if (utterance.id !== utteranceId) {
          return utterance;
        }

        updatedUtterance = updater(utterance);
        return updatedUtterance;
      });
      afterUpdate?.(snapshot);
      snapshot.metrics.emotion_total = snapshot.utterances.filter(
        (utterance) => utterance.emotion_status === "done"
      ).length;
      snapshot.metrics.emotion_queue_depth = options.emotionQueue.qsize();
    });
    return updatedUtterance;
  }

  function commitSnapshot(
    mutate: (snapshot: RuntimeSnapshot) => void
  ): RuntimeSnapshot {
    const snapshot = options.runtime.getSnapshot();
    const previousMetrics = JSON.stringify(snapshot.metrics);
    mutate(snapshot);
    const nextSnapshot = options.runtime.setSnapshot(snapshot);
    if (JSON.stringify(nextSnapshot.metrics) !== previousMetrics) {
      options.runtime.publish({
        type: "runtime:metrics",
        payload: nextSnapshot.metrics
      });
    }
    return nextSnapshot;
  }
}
