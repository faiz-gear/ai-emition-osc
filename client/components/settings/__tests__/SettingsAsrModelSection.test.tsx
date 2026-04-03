import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardI18nProvider } from "@/lib/i18n";

import {
  SettingsAsrModelSection,
  type AsrModelDownloadState,
} from "../SettingsAsrModelSection";

function renderSection({
  listening = false,
  downloadStates = {},
  installedModels = [
    {
      modelId: "whisper-tiny",
      installedAt: "2026-04-01T00:00:00.000Z",
      sizeBytes: 1_024 * 1_024 * 75,
      active: true,
    },
  ],
  onDownloadModel = vi.fn(),
  onActivateModel = vi.fn(),
  onDeleteModel = vi.fn(),
}: {
  listening?: boolean;
  downloadStates?: Record<string, AsrModelDownloadState | undefined>;
  installedModels?: Array<{
    modelId: string;
    installedAt: string;
    sizeBytes: number;
    active: boolean;
  }>;
  onDownloadModel?: ReturnType<typeof vi.fn>;
  onActivateModel?: ReturnType<typeof vi.fn>;
  onDeleteModel?: ReturnType<typeof vi.fn>;
} = {}) {
  render(
    <DashboardI18nProvider>
      <SettingsAsrModelSection
        catalog={[
          {
            modelId: "whisper-tiny",
            name: "Whisper Tiny",
            language: "multilingual",
            sizeBytes: 1_024 * 1_024 * 75,
            recommended: true,
          },
          {
            modelId: "whisper-base-en",
            name: "Whisper Base EN",
            language: "en",
            sizeBytes: 1_024 * 1_024 * 140,
          },
        ]}
        installedModels={installedModels}
        downloadStates={downloadStates}
        listening={listening}
        onDownloadModel={onDownloadModel}
        onActivateModel={onActivateModel}
        onDeleteModel={onDeleteModel}
      />
    </DashboardI18nProvider>,
  );

  return { onDownloadModel, onActivateModel, onDeleteModel };
}

describe("SettingsAsrModelSection", () => {
  it("renders predefined models with install and active status", () => {
    renderSection();

    const activeCard = screen.getByText("Whisper Tiny").closest("article");
    const installedCard = screen.getByText("Whisper Base EN").closest("article");

    expect(activeCard).not.toBeNull();
    expect(installedCard).not.toBeNull();

    expect(within(activeCard as HTMLElement).getByText("Recommended")).toBeInTheDocument();
    expect(within(activeCard as HTMLElement).getByText(/Multilingual/)).toBeInTheDocument();
    expect(within(activeCard as HTMLElement).getByText("Active")).toBeInTheDocument();
    expect(within(installedCard as HTMLElement).getByText(/English/)).toBeInTheDocument();
    expect(within(installedCard as HTMLElement).getByText("Not installed")).toBeInTheDocument();
  });

  it("dispatches a model download", () => {
    const { onDownloadModel } = renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(onDownloadModel).toHaveBeenCalledWith("whisper-base-en");
  });

  it("renders progress copy for an in-flight download", () => {
    renderSection({
      downloadStates: {
        "whisper-base-en": {
          status: "downloading",
          progressPercent: 50,
        },
      },
    });
    expect(screen.getByText("Downloading 50%")).toBeInTheDocument();
  });

  it("allows retrying a failed download", () => {
    const { onDownloadModel } = renderSection({
      downloadStates: {
        "whisper-base-en": {
          status: "failed",
          progressPercent: null,
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(onDownloadModel).toHaveBeenCalledWith("whisper-base-en");
  });

  it("disables activation while listening", () => {
    const { onActivateModel } = renderSection({
      listening: true,
      installedModels: [
        {
          modelId: "whisper-base-en",
          installedAt: "2026-04-02T00:00:00.000Z",
          sizeBytes: 1_024 * 1_024 * 140,
          active: false,
        },
      ],
    });

    const activateButton = screen.getByRole("button", { name: "Activate" });

    expect(activateButton).toBeDisabled();
    expect(
      screen.getByText("Stop listening to activate or remove ASR models."),
    ).toBeInTheDocument();

    fireEvent.click(activateButton);
    expect(onActivateModel).not.toHaveBeenCalled();
  });

  it("disables deleting the active model", () => {
    const { onDeleteModel } = renderSection();

    const deleteButton = screen.getByRole("button", { name: "Delete" });

    expect(deleteButton).toBeDisabled();
    fireEvent.click(deleteButton);
    expect(onDeleteModel).not.toHaveBeenCalled();
  });
});
