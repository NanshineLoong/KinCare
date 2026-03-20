import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";

import type { ComposerAttachment } from "../attachments";
import { usePreferences } from "../preferences";

type MemberOption = {
  id: string;
  name: string;
};

type ChatInputProps = {
  attachments?: ComposerAttachment[];
  draft: string;
  isBusy: boolean;
  isUploading?: boolean;
  memberOptions: MemberOption[];
  onAttachmentRemove?: (attachmentId: string) => void;
  onAttachmentUpload?: (file: File) => void;
  onDraftChange: (value: string) => void;
  onMemberChange: (memberId: string) => void;
  onSend: () => void;
  selectedMemberId: string;
  placeholder?: string;
};

export function ChatInput({
  attachments = [],
  draft,
  isBusy,
  isUploading = false,
  memberOptions,
  onAttachmentRemove,
  onAttachmentUpload,
  onDraftChange,
  onMemberChange,
  onSend,
  selectedMemberId,
  placeholder,
}: ChatInputProps) {
  const { t } = usePreferences();
  const resolvedPlaceholder = placeholder ?? t("homeComposerPlaceholder");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [hasStartedVoiceUpload, setHasStartedVoiceUpload] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const attachmentInputId = useId().replace(/:/g, "-");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasPendingAttachments =
    isUploading || attachments.some((attachment) => attachment.status === "uploading");
  const hasReadyAttachments = attachments.some(
    (attachment) => attachment.status === "ready" && attachment.context,
  );
  const canSend = !isBusy && !hasPendingAttachments && (Boolean(draft.trim()) || hasReadyAttachments);

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
    if (!isProcessingVoice || !hasStartedVoiceUpload || isUploading) {
      return;
    }
    setIsProcessingVoice(false);
    setHasStartedVoiceUpload(false);
    setIsVoiceMode(false);
  }, [hasStartedVoiceUpload, isProcessingVoice, isUploading]);

  useEffect(() => {
    if (!mediaRecorder || !onAttachmentUpload) {
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
      onAttachmentUpload(file);
      clearCanvas();
    };

    mediaRecorder.addEventListener("dataavailable", handleDataAvailable);
    return () => {
      mediaRecorder.removeEventListener("dataavailable", handleDataAvailable);
    };
  }, [clearCanvas, mediaRecorder, onAttachmentUpload]);

  const dispatchAttachment = useCallback((file: File | null | undefined) => {
    if (!file || !onAttachmentUpload) {
      return;
    }
    onAttachmentUpload(file);
  }, [onAttachmentUpload]);

  const handlePastedFile = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const fileItem = items.find((item) => item.kind === "file");
    const file = fileItem?.getAsFile();
    if (!file) {
      return;
    }
    event.preventDefault();
    dispatchAttachment(file);
  }, [dispatchAttachment]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    dispatchAttachment(file);
  }, [dispatchAttachment]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  }, [isDragActive]);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsDragActive(false);
  }, []);

  const handleSendOrConfirm = () => {
    if (isVoiceMode) {
      if (isRecording) {
        stopRecording();
      }
    } else {
      if (draft.trim() || hasReadyAttachments) {
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
    <div
      className={`mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-[1.5rem] border bg-white p-3 shadow-sm transition-all focus-within:border-[#4A443F]/50 focus-within:shadow-md ${
        isDragActive
          ? "border-[#4A6076] bg-[#F5F8FB] ring-2 ring-[#D8E5EF]"
          : "border-[#F2EDE7]"
      }`}
      data-testid="chat-input-dropzone"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-2 pt-1">
          {attachments.map((attachment) => (
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                attachment.status === "uploading"
                  ? "border-[#D8E5EF] bg-[#F5F8FB] text-[#4A6076]"
                  : "border-[#D3E4D7] bg-[#F3F8F4] text-[#305445]"
              }`}
              key={attachment.id}
            >
              {attachment.status === "uploading" ? (
                <span
                  aria-label={`附件 ${attachment.filename} 上传进度`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(attachment.progress)}
                  className="relative h-4 w-4 shrink-0 rounded-full"
                  role="progressbar"
                  style={{
                    background: `conic-gradient(#4A6076 ${attachment.progress}%, #D8E5EF ${attachment.progress}% 100%)`,
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-[2px] rounded-full bg-[#F5F8FB]"
                  />
                </span>
              ) : (
                <span
                  aria-hidden
                  className="material-symbols-outlined text-[16px] text-[#4A8C68]"
                >
                  check_circle
                </span>
              )}
              <span className="max-w-[12rem] truncate">{attachment.filename}</span>
              {attachment.status === "uploading" ? (
                <span className="text-[11px] text-[#7A8E9F]">
                  {Math.round(attachment.progress)}%
                </span>
              ) : null}
              {onAttachmentRemove ? (
                <button
                  aria-label={
                    attachment.status === "uploading"
                      ? `取消上传附件 ${attachment.filename}`
                      : `移除附件 ${attachment.filename}`
                  }
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[#4A6076] transition hover:bg-white"
                  onClick={() => onAttachmentRemove(attachment.id)}
                  type="button"
                >
                  <span aria-hidden className="material-symbols-outlined text-[14px]">close</span>
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

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
            onPaste={handlePastedFile}
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
            onClick={() => document.getElementById(attachmentInputId)?.click()}
            type="button"
          >
            <span aria-hidden className="material-symbols-outlined text-[20px]">add</span>
          </button>
          <input
            accept="audio/*,image/*,.pdf,.doc,.docx"
            className="hidden"
            data-chat-attachment-input="true"
            id={attachmentInputId}
            onChange={(e) => {
              const file = e.target.files?.[0];
              dispatchAttachment(file);
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
                disabled={isBusy || isProcessingVoice || isUploading}
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
                disabled={!canSend}
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
