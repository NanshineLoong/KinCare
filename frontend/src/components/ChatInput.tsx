import { useEffect, useRef, useState, useCallback } from "react";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";

import { usePreferences } from "../preferences";

type MemberOption = {
  id: string;
  name: string;
};

type ChatInputProps = {
  draft: string;
  isBusy: boolean;
  memberOptions: MemberOption[];
  onDraftChange: (value: string) => void;
  onMemberChange: (memberId: string) => void;
  onSend: () => void;
  onAudioUpload?: (file: File) => void;
  selectedMemberId: string;
  placeholder?: string;
};

export function ChatInput({
  draft,
  isBusy,
  memberOptions,
  onDraftChange,
  onMemberChange,
  onSend,
  onAudioUpload,
  selectedMemberId,
  placeholder,
}: ChatInputProps) {
  const { t } = usePreferences();
  const resolvedPlaceholder = placeholder ?? t("homeComposerPlaceholder");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [hasStartedVoiceUpload, setHasStartedVoiceUpload] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const voiceVisualizer = useVoiceVisualizer();
  const {
    startRecording,
    stopRecording,
    isRecordingInProgress: isRecording,
    clearCanvas,
    mediaRecorder,
    error: voiceError,
  } = voiceVisualizer;

  const handleToggleVoiceMode = useCallback(() => {
    let shouldStartRecording = false;
    setIsVoiceMode((prev) => {
      const next = !prev;
      if (!next && isRecording) {
        stopRecording();
        clearCanvas();
      }
      if (next) {
        shouldStartRecording = true; // 进入语音模式时需启动麦克风
      }
      return next;
    });
    if (shouldStartRecording) {
      startRecording();
    }
  }, [isRecording, stopRecording, clearCanvas, startRecording]);

  const handleStartVoiceRecording = useCallback(() => {
    setIsVoiceMode(true);
    startRecording();
  }, [startRecording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+M to toggle voice/text mode (Mac and Windows/Linux both use Ctrl)
      if (e.ctrlKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        handleToggleVoiceMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleVoiceMode]);

  useEffect(() => {
    if (!isProcessingVoice || !hasStartedVoiceUpload || isBusy) {
      return;
    }
    setIsProcessingVoice(false);
    setHasStartedVoiceUpload(false);
    setIsVoiceMode(false);
  }, [hasStartedVoiceUpload, isBusy, isProcessingVoice]);

  useEffect(() => {
    if (!mediaRecorder || !onAudioUpload) {
      return;
    }

    const handleDataAvailable = (event: BlobEvent) => {
      const audioBlob = event.data;
      if (!audioBlob || audioBlob.size === 0) {
        setIsProcessingVoice(false);
        setHasStartedVoiceUpload(false);
        setIsVoiceMode(false);
        clearCanvas();
        return;
      }

      const file = new File([audioBlob], "voice-message.webm", {
        type: audioBlob.type || "audio/webm",
      });
      setHasStartedVoiceUpload(true);
      onAudioUpload(file);
      clearCanvas();
    };

    mediaRecorder.addEventListener("dataavailable", handleDataAvailable);
    return () => {
      mediaRecorder.removeEventListener("dataavailable", handleDataAvailable);
    };
  }, [clearCanvas, mediaRecorder, onAudioUpload]);

  const handleSendOrConfirm = () => {
    if (isVoiceMode) {
      if (isRecording) {
        stopRecording();
      }
    } else {
      if (draft.trim()) {
        onSend();
      }
    }
  };

  const handleCancelVoice = () => {
    setIsVoiceMode(false);
    setIsProcessingVoice(false);
    setHasStartedVoiceUpload(false);
    if (isRecording) {
      stopRecording();
    }
    clearCanvas();
  };

  const handleCompleteVoiceRecording = () => {
    if (!isRecording) {
      return;
    }
    setIsProcessingVoice(true);
    stopRecording();
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-[1.5rem] border border-[#F2EDE7] bg-white p-3 shadow-sm transition-all focus-within:border-[#4A443F]/50 focus-within:shadow-md">
      {/* Row 1: Text Input or Voice Visualizer */}
      <div className="flex min-h-[48px] items-center px-2">
        {isVoiceMode ? (
          <div className="flex min-w-0 flex-1 items-center">
            {voiceError ? (
              <p className="text-sm text-red-500">
                {t("chatInputMicError", { message: voiceError.message })}
              </p>
            ) : (
              <div className="h-10 min-w-0 flex-1 overflow-hidden rounded-lg bg-[#F8F6F3]">
                <VoiceVisualizer
                  controls={voiceVisualizer}
                  height={40}
                  width="100%"
                  fullscreen
                  isControlPanelShown={false}
                  isDefaultUIShown={false}
                  onlyRecording
                  mainBarColor="#4A443F"
                  secondaryBarColor="#B8B0A9"
                  backgroundColor="transparent"
                />
              </div>
            )}
          </div>
        ) : (
          <textarea
            aria-label={t("chatInputLabel")}
            ref={inputRef}
            className="min-h-[24px] w-full resize-none border-none bg-transparent py-2 text-[16px] text-[#2D2926] outline-none placeholder:text-[#B8B0A9]"
            placeholder={resolvedPlaceholder}
            value={draft}
            onChange={(e) => {
              onDraftChange(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendOrConfirm();
              }
            }}
            rows={1}
            style={{ maxHeight: "120px" }}
          />
        )}
      </div>

      {/* Row 2: Controls */}
      <div className="flex items-center justify-between border-t border-[#F8F6F3] pt-2">
        <div className="flex items-center gap-2">
          {/* Add button for attachments */}
          <button
            aria-label={t("chatInputAddAttachment")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-warm-gray transition hover:bg-[#F8F6F3] hover:text-[#4A443F]"
            onClick={() => document.getElementById('chat-attachment-input')?.click()}
            type="button"
          >
            <span aria-hidden className="material-symbols-outlined text-[20px]">add</span>
          </button>
          <input
            accept="audio/*,image/*,.pdf,.doc,.docx"
            className="hidden"
            id="chat-attachment-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onAudioUpload) {
                onAudioUpload(file);
              }
              e.target.value = '';
            }}
            type="file"
          />

          {/* Member Selector */}
          <div className="relative flex items-center">
             <span aria-hidden className="material-symbols-outlined absolute left-2 text-[16px] text-warm-gray pointer-events-none">person</span>
            <select
              className="appearance-none rounded-full border border-[#F2EDE7] bg-[#F8F6F3] py-1.5 pl-8 pr-8 text-xs font-medium text-[#4A443F] outline-none transition hover:bg-[#F2EDE7] focus:border-[#4A443F]/50"
              onChange={(e) => onMemberChange(e.target.value)}
              value={selectedMemberId}
              disabled={isVoiceMode}
            >
              <option value="">{t("chatInputNoMember")}</option>
              {memberOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <span aria-hidden className="material-symbols-outlined absolute right-2 text-[16px] text-warm-gray pointer-events-none">expand_more</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isVoiceMode ? (
            <>
              <button
                aria-label={t("chatInputCancelVoice")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1d6d6] text-[#9a5e5e] transition hover:bg-[#e6c1c1]"
                onClick={handleCancelVoice}
                type="button"
              >
                <span aria-hidden className="material-symbols-outlined text-[18px]">close</span>
              </button>
              <button
                aria-label={t("chatInputFinishVoice")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2D2926] text-white transition hover:bg-black"
                onClick={handleCompleteVoiceRecording}
                disabled={isBusy || isProcessingVoice}
                type="button"
              >
                {isProcessingVoice ? (
                  <span
                    aria-hidden
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  />
                ) : (
                  <span aria-hidden className="material-symbols-outlined text-[18px]">check</span>
                )}
              </button>
            </>
          ) : (
            <>
               <button
                aria-label={t("chatInputVoice")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8F6F3] text-[#4A443F] transition hover:bg-[#F2EDE7]"
                onClick={handleStartVoiceRecording}
                type="button"
              >
                <span aria-hidden className="material-symbols-outlined text-[18px]">mic</span>
              </button>
              <button
                aria-label={t("chatInputSend")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2D2926] text-white transition hover:bg-black disabled:opacity-50"
                onClick={handleSendOrConfirm}
                disabled={!draft.trim() || isBusy}
                type="button"
              >
                <span aria-hidden className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
