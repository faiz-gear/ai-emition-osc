"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "zh";

export const LOCALE_STORAGE_KEY = "dashboard.locale";

const EN_MESSAGES = {
  localeSwitcherLabel: "Language",
  localeEnglish: "EN",
  localeChinese: "中文",
  dashboardEyebrow: "Speech Intelligence Control",
  dashboardTitle: "AI Emotion Monitor",
  dashboardDescription:
    "Track live utterances, response latency, and emotion inference health with a tuned operations surface.",
  navConsole: "Console",
  navSettings: "Settings",
  endpoints: "Endpoints",
  settingsTitle: "Settings",
  settingsDescription:
    "Manage locale, runtime endpoints, and provider operations in one place.",
  settingsDesktopUnavailableTitle: "Desktop Runtime Required",
  settingsDesktopUnavailableDescription:
    "Open Settings inside the Electron desktop app to access ASR, provider, and runtime controls.",
  settingsLanguageTitle: "Language",
  settingsLanguageDescription:
    "Choose the UI locale used by both Console and Settings routes.",
  settingsEndpointTitle: "Runtime Endpoints",
  settingsEndpointDescription:
    "Configure API and WebSocket base endpoints for runtime operations.",
  settingsProviderTitle: "Providers",
  settingsProviderDescription:
    "Manage inference providers against the current API endpoint.",
  settingsAsrModelTitle: "ASR Models",
  settingsAsrModelDescription:
    "Download and activate local Whisper models for desktop speech recognition.",
  settingsAsrModelRecommended: "Recommended",
  settingsAsrModelLanguageMultilingual: "Multilingual",
  settingsAsrModelLanguageZh: "Chinese",
  settingsAsrModelLanguageEn: "English",
  settingsAsrModelStatusNotInstalled: "Not installed",
  settingsAsrModelStatusInstalled: "Installed",
  settingsAsrModelStatusActive: "Active",
  settingsAsrModelStatusQueued: "Queued",
  settingsAsrModelStatusDownloading: "Downloading",
  settingsAsrModelStatusVerifying: "Verifying",
  settingsAsrModelStatusReady: "Ready",
  settingsAsrModelStatusFailed: "Failed",
  settingsAsrModelSize: "{sizeMb} MB",
  settingsAsrModelDownload: "Download",
  settingsAsrModelActivate: "Activate",
  settingsAsrModelDelete: "Delete",
  settingsAsrModelDownloadProgress: "{status} {progress}%",
  settingsAsrModelListeningBlocked: "Stop listening to activate or remove ASR models.",
  settingsRecognitionStrategyTitle: "Recognition Strategy",
  settingsRecognitionStrategyDescription:
    "Choose whether desktop speech recognition auto-detects language or stays fixed.",
  settingsRecognitionStrategyAuto: "Auto Detect",
  settingsRecognitionStrategyFixed: "Fixed Language",
  settingsRecognitionStrategyFixedLabel: "Recognition Language",
  settingsRecognitionStrategyListeningBlocked:
    "Stop listening to change the recognition strategy.",
  settingsRecognitionStrategyChinese: "Chinese",
  settingsRecognitionStrategyEnglish: "English",
  settingsApiBaseLabel: "API Base URL",
  settingsWsUrlLabel: "WebSocket URL",
  settingsSave: "Save",
  settingsReset: "Reset to Default",
  settingsSaving: "Saving...",
  settingsResetting: "Resetting...",
  settingsDismissWarning: "Dismiss warning",
  settingsValidationApiBase: "API base URL must use http:// or https://.",
  settingsValidationWsUrl: "WebSocket URL must use ws:// or wss://.",
  settingsMutationFailed: "Failed to update runtime config.",
  settingsStorageWriteFailed: "Unable to persist runtime config.",
  settingsWarningInvalidJson:
    "Stored runtime config is invalid JSON. Defaults were applied.",
  settingsWarningInvalidShape:
    "Stored runtime config shape is invalid. Defaults were applied.",
  settingsWarningVersionMismatch:
    "Stored runtime config version is unsupported. Defaults were applied.",
  settingsWarningInvalidEnvDefault:
    "Environment runtime defaults are invalid. Safe fallback values were applied.",
  settingsWarningStorageUnavailable:
    "Local storage is unavailable. Settings will apply for this session only.",
  start: "Start",
  starting: "Starting...",
  stop: "Stop",
  stopping: "Stopping...",
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
  listening: "Listening",
  stopped: "Stopped",
  showErrorDetails: "Show error details",
  error: "Error",
  dismiss: "Dismiss",
  lastError: "Last Error",
  close: "Close",
  unknownError: "unknown-error",
  liveTranscript: "Live Transcript",
  waitingForSpeech: "(Waiting for speech...)",
  startListeningHint: "Start listening to populate the transcript stream with live speech segments.",
  freshnessLive: "LIVE",
  freshnessIdle: "IDLE",
  freshnessStale: "STALE",
  utteranceStream: "Utterance Stream",
  followLatest: "Follow latest",
  on: "On",
  off: "Off",
  noUtterances: "No utterances yet.",
  incomingSpeechHint: "Incoming speech segments will appear here with status and emotion summary.",
  emptyUtterance: "(empty)",
  emotionStatusQueued: "queued",
  emotionStatusProcessing: "processing",
  emotionStatusDone: "done",
  emotionStatusDropped: "dropped",
  emotionStatusError: "error",
  dominant: "Dominant",
  expand: "Expand",
  collapse: "Collapse",
  utteranceAria: "Utterance {id}",
  expandAria: "Expand {id}",
  collapseAria: "Collapse {id}",
  realtimeOps: "Realtime Ops",
  latency: "Latency",
  queue: "Queue",
  utterances: "Utterances",
  emotion: "Emotion",
  errors: "Errors",
  ws: "WS",
  unitMs: "ms",
  unitCount: "count",
  unitTotal: "total",
  unitClients: "clients",
  emotionDetail: "Emotion Detail",
  selectUtteranceHint: "Select an utterance to inspect emotion details.",
  noEmotionResultYet: "No emotion result yet.",
  advanced: "Advanced",
  show: "Show",
  hide: "Hide",
  runtimeHint: "Runtime stream is active while listening is enabled.",
  providerManager: "Provider Manager",
  providerManagerDescription: "Configure model backends for emotion inference.",
  refresh: "Refresh",
  noProvidersConfigured: "No providers configured yet.",
  modelLabel: "model",
  baseLabel: "base",
  active: "Active",
  activate: "Activate",
  test: "Test",
  edit: "Edit",
  delete: "Delete",
  name: "Name",
  providerType: "Provider Type",
  model: "Model",
  baseUrl: "Base URL",
  providerKey: "Provider Key",
  temperature: "Temperature",
  apiKey: "API Key",
  headersJson: "Headers JSON",
  humanLabelHint: "Human-readable provider label.",
  providerTypeLockHint: "Locked while editing an existing provider.",
  modelHint: "Backend model identifier.",
  baseUrlHint: "Optional endpoint override.",
  providerKeyHint: "Used for openai_compatible providers.",
  temperatureHint: "Range typically 0.0 to 2.0.",
  apiKeyHintEdit: "Leave blank to keep existing value.",
  apiKeyHintCreate: "Optional for local backends.",
  headersExample: "Example:",
  updateProvider: "Update Provider",
  createProvider: "Create Provider",
  cancelEdit: "Cancel Edit",
  providerUpdated: "Provider updated",
  providerCreated: "Provider created",
  providerTestOk: "Provider test OK ({latency}ms)",
} as const;

const ZH_MESSAGES: Record<keyof typeof EN_MESSAGES, string> = {
  localeSwitcherLabel: "语言",
  localeEnglish: "EN",
  localeChinese: "中文",
  dashboardEyebrow: "语音智能控制台",
  dashboardTitle: "AI 情绪监控台",
  dashboardDescription: "在统一运维视图中跟踪实时话语、响应时延与情绪推断健康度。",
  navConsole: "控制台",
  navSettings: "设置",
  endpoints: "端点",
  settingsTitle: "设置",
  settingsDescription: "在这里统一管理语言、运行时端点和提供方操作。",
  settingsDesktopUnavailableTitle: "需要桌面运行时",
  settingsDesktopUnavailableDescription:
    "请在 Electron 桌面应用内打开设置页，才能访问 ASR、Provider 和运行时控制。",
  settingsLanguageTitle: "语言",
  settingsLanguageDescription: "选择控制台与设置页共享的界面语言。",
  settingsEndpointTitle: "运行时端点",
  settingsEndpointDescription: "配置运行时 API 与 WebSocket 端点。",
  settingsProviderTitle: "提供方",
  settingsProviderDescription: "基于当前 API 端点管理推断提供方。",
  settingsAsrModelTitle: "ASR 模型",
  settingsAsrModelDescription: "下载并启用桌面语音识别使用的本地 Whisper 模型。",
  settingsAsrModelRecommended: "推荐",
  settingsAsrModelLanguageMultilingual: "多语言",
  settingsAsrModelLanguageZh: "中文",
  settingsAsrModelLanguageEn: "英文",
  settingsAsrModelStatusNotInstalled: "未安装",
  settingsAsrModelStatusInstalled: "已安装",
  settingsAsrModelStatusActive: "已启用",
  settingsAsrModelStatusQueued: "排队中",
  settingsAsrModelStatusDownloading: "下载中",
  settingsAsrModelStatusVerifying: "校验中",
  settingsAsrModelStatusReady: "可用",
  settingsAsrModelStatusFailed: "失败",
  settingsAsrModelSize: "{sizeMb} MB",
  settingsAsrModelDownload: "下载",
  settingsAsrModelActivate: "启用",
  settingsAsrModelDelete: "删除",
  settingsAsrModelDownloadProgress: "{status} {progress}%",
  settingsAsrModelListeningBlocked: "请先停止监听，再启用或删除 ASR 模型。",
  settingsRecognitionStrategyTitle: "识别策略",
  settingsRecognitionStrategyDescription: "选择桌面语音识别是自动检测语言，还是固定到单一语言。",
  settingsRecognitionStrategyAuto: "自动检测",
  settingsRecognitionStrategyFixed: "固定语言",
  settingsRecognitionStrategyFixedLabel: "识别语言",
  settingsRecognitionStrategyListeningBlocked: "请先停止监听，再修改识别策略。",
  settingsRecognitionStrategyChinese: "中文",
  settingsRecognitionStrategyEnglish: "英文",
  settingsApiBaseLabel: "API 基础地址",
  settingsWsUrlLabel: "WebSocket 地址",
  settingsSave: "保存",
  settingsReset: "恢复默认",
  settingsSaving: "保存中...",
  settingsResetting: "重置中...",
  settingsDismissWarning: "忽略警告",
  settingsValidationApiBase: "API 地址必须以 http:// 或 https:// 开头。",
  settingsValidationWsUrl: "WebSocket 地址必须以 ws:// 或 wss:// 开头。",
  settingsMutationFailed: "更新运行时配置失败。",
  settingsStorageWriteFailed: "无法持久化运行时配置。",
  settingsWarningInvalidJson: "本地运行时配置 JSON 无效，已回退到默认值。",
  settingsWarningInvalidShape: "本地运行时配置结构无效，已回退到默认值。",
  settingsWarningVersionMismatch: "本地运行时配置版本不受支持，已回退到默认值。",
  settingsWarningInvalidEnvDefault: "环境默认配置无效，已应用安全回退值。",
  settingsWarningStorageUnavailable: "本地存储不可用，本次会话内仍可使用。",
  start: "开始",
  starting: "启动中...",
  stop: "停止",
  stopping: "停止中...",
  connected: "已连接",
  connecting: "连接中",
  disconnected: "未连接",
  listening: "监听中",
  stopped: "已停止",
  showErrorDetails: "查看错误详情",
  error: "错误",
  dismiss: "忽略",
  lastError: "最近错误",
  close: "关闭",
  unknownError: "未知错误",
  liveTranscript: "实时转写",
  waitingForSpeech: "（等待语音输入...）",
  startListeningHint: "开始监听后，这里会持续显示实时语音片段。",
  freshnessLive: "实时",
  freshnessIdle: "空闲",
  freshnessStale: "过期",
  utteranceStream: "话语流",
  followLatest: "跟随最新",
  on: "开",
  off: "关",
  noUtterances: "暂无话语数据。",
  incomingSpeechHint: "新的语音片段会在此显示，并附带状态和情绪摘要。",
  emptyUtterance: "（空）",
  emotionStatusQueued: "排队中",
  emotionStatusProcessing: "处理中",
  emotionStatusDone: "完成",
  emotionStatusDropped: "已丢弃",
  emotionStatusError: "错误",
  dominant: "主导情绪",
  expand: "展开",
  collapse: "收起",
  utteranceAria: "话语 {id}",
  expandAria: "展开 {id}",
  collapseAria: "收起 {id}",
  realtimeOps: "实时运维",
  latency: "延迟",
  queue: "队列",
  utterances: "话语数",
  emotion: "情绪数",
  errors: "错误数",
  ws: "WS",
  unitMs: "毫秒",
  unitCount: "个",
  unitTotal: "总计",
  unitClients: "客户端",
  emotionDetail: "情绪详情",
  selectUtteranceHint: "选择一条话语以查看情绪详情。",
  noEmotionResultYet: "暂无情绪结果。",
  advanced: "高级",
  show: "展开",
  hide: "收起",
  runtimeHint: "启用监听时将保持实时流运行。",
  providerManager: "模型提供方管理",
  providerManagerDescription: "配置用于情绪推断的模型后端。",
  refresh: "刷新",
  noProvidersConfigured: "尚未配置任何提供方。",
  modelLabel: "模型",
  baseLabel: "基础地址",
  active: "已启用",
  activate: "启用",
  test: "测试",
  edit: "编辑",
  delete: "删除",
  name: "名称",
  providerType: "提供方类型",
  model: "模型",
  baseUrl: "基础地址",
  providerKey: "Provider Key",
  temperature: "Temperature",
  apiKey: "API Key",
  headersJson: "请求头 JSON",
  humanLabelHint: "给提供方设置一个易读名称。",
  providerTypeLockHint: "编辑已有提供方时不可修改。",
  modelHint: "后端模型标识。",
  baseUrlHint: "可选的端点覆盖地址。",
  providerKeyHint: "仅 openai_compatible 类型需要。",
  temperatureHint: "通常范围是 0.0 到 2.0。",
  apiKeyHintEdit: "留空表示保持原值。",
  apiKeyHintCreate: "本地后端可选。",
  headersExample: "示例：",
  updateProvider: "更新提供方",
  createProvider: "创建提供方",
  cancelEdit: "取消编辑",
  providerUpdated: "提供方已更新",
  providerCreated: "提供方已创建",
  providerTestOk: "提供方测试成功（{latency}毫秒）",
};

type Messages = Record<keyof typeof EN_MESSAGES, string>;

const MESSAGES: Record<Locale, Messages> = {
  en: EN_MESSAGES,
  zh: ZH_MESSAGES,
};

type MessageKey = keyof typeof EN_MESSAGES;
type MessageValues = Record<string, string | number>;
type Translate = (key: MessageKey, values?: MessageValues) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
};

function interpolate(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key in values) {
      return String(values[key]);
    }
    return `{${key}}`;
  });
}

function translate(locale: Locale, key: MessageKey, values?: MessageValues) {
  const table = MESSAGES[locale] ?? EN_MESSAGES;
  return interpolate(table[key] ?? EN_MESSAGES[key], values);
}

function loadStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === "zh" || raw === "en") {
      return raw;
    }
  } catch {
    return null;
  }

  return null;
}

function persistLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors; locale still works in-memory.
  }
}

const defaultContext: I18nContextValue = {
  locale: "en",
  setLocale: () => {},
  t: (key, values) => translate("en", key, values),
};

const I18nContext = createContext<I18nContextValue>(defaultContext);

export function DashboardI18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = loadStoredLocale();
    if (stored) {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const t = useCallback<Translate>(
    (key, values) => translate(locale, key, values),
    [locale],
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
