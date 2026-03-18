import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      <ChatInput
        draft=""
        isBusy={false}
        memberOptions={[]}
        onAudioUpload={handleAudioUpload}
        onDraftChange={() => {}}
        onMemberChange={() => {}}
        onSend={() => {}}
        selectedMemberId=""
      />,
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
    );
    rerender(
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
    );

    expect(voiceVisualizerState.stopRecording).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("识别后的文字"));
  });

  it("shows a spinner on the complete button while processing recorded audio", () => {
    render(
      <ChatInput
        draft=""
        isBusy={false}
        memberOptions={[]}
        onAudioUpload={() => {}}
        onDraftChange={() => {}}
        onMemberChange={() => {}}
        onSend={() => {}}
        selectedMemberId=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "语音输入" }));
    fireEvent.click(screen.getByRole("button", { name: "结束录音并发送" }));

    const button = screen.getByRole("button", { name: "结束录音并发送" });
    expect(button.querySelector(".animate-spin")).not.toBeNull();
  });
});
