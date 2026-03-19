import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "../preferences";
import { ChatInput } from "./ChatInput";

const voiceVisualizerState = vi.hoisted(() => ({
  mediaRecorder: null as MockMediaRecorder | null,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  clearCanvas: vi.fn(),
}));

vi.mock("react-voice-visualizer", () => ({
  VoiceVisualizer: () => <div data-testid="voice-visualizer" />,
  useVoiceVisualizer: () => ({
    startRecording: voiceVisualizerState.startRecording,
    stopRecording: voiceVisualizerState.stopRecording,
    isRecordingInProgress: true,
    clearCanvas: voiceVisualizerState.clearCanvas,
    mediaRecorder: voiceVisualizerState.mediaRecorder,
    error: null,
  }),
}));

type DataAvailableHandler = (event: { data: Blob }) => void;
type MockMediaRecorder = MediaRecorder & { emitDataAvailable: (blob: Blob) => void };

function createMediaRecorderMock() {
  let dataAvailableHandler: DataAvailableHandler | null = null;

  return {
    addEventListener: vi.fn((eventName: string, handler: DataAvailableHandler) => {
      if (eventName === "dataavailable") {
        dataAvailableHandler = handler;
      }
    }),
    removeEventListener: vi.fn((eventName: string, handler: DataAvailableHandler) => {
      if (eventName === "dataavailable" && dataAvailableHandler === handler) {
        dataAvailableHandler = null;
      }
    }),
    emitDataAvailable(blob: Blob) {
      dataAvailableHandler?.({ data: blob });
    },
  } as unknown as MockMediaRecorder;
}

describe("ChatInput", () => {
  beforeEach(() => {
    voiceVisualizerState.startRecording.mockReset();
    voiceVisualizerState.stopRecording.mockReset();
    voiceVisualizerState.clearCanvas.mockReset();
    voiceVisualizerState.mediaRecorder = createMediaRecorderMock();
  });

  it("uploads the recorded audio after completing voice input and returns to text mode", async () => {
    const handleAudioUpload = vi.fn();
    const { rerender } = render(
      <PreferencesProvider>
        <ChatInput
          draft=""
          isBusy={false}
          memberOptions={[]}
          onAudioUpload={handleAudioUpload}
          onDraftChange={() => {}}
          onMemberChange={() => {}}
          onSend={() => {}}
          selectedMemberId=""
        />
      </PreferencesProvider>,
    );
    
    fireEvent.click(screen.getByRole("button", { name: "语音输入" }));
    fireEvent.click(screen.getByRole("button", { name: "结束录音并发送" }));

    await act(async () => {
      voiceVisualizerState.mediaRecorder?.emitDataAvailable(
        new Blob(["voice"], { type: "audio/webm" }),
      );
    });

    await waitFor(() => expect(handleAudioUpload).toHaveBeenCalledTimes(1));

    rerender(
      <PreferencesProvider>
        <ChatInput
          draft=""
          isBusy
          memberOptions={[]}
          onAudioUpload={handleAudioUpload}
          onDraftChange={() => {}}
          onMemberChange={() => {}}
          onSend={() => {}}
          selectedMemberId=""
        />
      </PreferencesProvider>
    );
    rerender(
      <PreferencesProvider>
        <ChatInput
          draft="识别后的文字"
          isBusy={false}
          memberOptions={[]}
          onAudioUpload={handleAudioUpload}
          onDraftChange={() => {}}
          onMemberChange={() => {}}
          onSend={() => {}}
          selectedMemberId=""
        />
      </PreferencesProvider>
    );

    expect(voiceVisualizerState.stopRecording).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("识别后的文字"));
  });

  it("shows a spinner on the complete button while processing recorded audio", () => {
    render(
      <PreferencesProvider>
        <ChatInput
          draft=""
          isBusy={false}
          memberOptions={[]}
          onAudioUpload={() => {}}
          onDraftChange={() => {}}
          onMemberChange={() => {}}
          onSend={() => {}}
          selectedMemberId=""
        />
      </PreferencesProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "语音输入" }));
    fireEvent.click(screen.getByRole("button", { name: "结束录音并发送" }));

    const button = screen.getByRole("button", { name: "结束录音并发送" });
    expect(button.querySelector(".animate-spin")).not.toBeNull();
  });

  it("toggles between text and voice mode with Ctrl+M", async () => {
    render(
      <PreferencesProvider>
        <ChatInput
          draft=""
          isBusy={false}
          memberOptions={[]}
          onAudioUpload={() => {}}
          onDraftChange={() => {}}
          onMemberChange={() => {}}
          onSend={() => {}}
          selectedMemberId=""
        />
      </PreferencesProvider>,
    );

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-visualizer")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "m", ctrlKey: true });

    await waitFor(() => {
      expect(voiceVisualizerState.startRecording).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("voice-visualizer")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "m", ctrlKey: true });

    await waitFor(() => {
      expect(voiceVisualizerState.stopRecording).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  it("sends on Enter and keeps Shift+Enter for multiline input", () => {
    const handleSend = vi.fn();

    render(
      <PreferencesProvider>
        <ChatInput
          draft="记录奶奶今天的午睡情况"
          isBusy={false}
          memberOptions={[]}
          onAudioUpload={() => {}}
          onDraftChange={() => {}}
          onMemberChange={() => {}}
          onSend={handleSend}
          selectedMemberId=""
        />
      </PreferencesProvider>,
    );

    const textbox = screen.getByRole("textbox");

    fireEvent.keyDown(textbox, { key: "Enter" });
    expect(handleSend).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(textbox, { key: "Enter", shiftKey: true });
    expect(handleSend).toHaveBeenCalledTimes(1);
  });
});
