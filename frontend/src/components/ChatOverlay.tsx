import { useEffect, useRef, type ChangeEvent, type SVGProps } from "react";

import type { ChatToolResult } from "../api/chat";


export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export type ChatToolCard = {
  id: string;
  result: ChatToolResult;
};

type MemberOption = {
  id: string;
  name: string;
};

type ChatOverlayProps = {
  draft: string;
  error: string | null;
  isBusy: boolean;
  memberOptions: MemberOption[];
  messages: ChatMessage[];
  onAttachmentUpload: (file: File) => void;
  onAudioUpload: (file: File) => void;
  onClose: () => void;
  onConfirmToolDraft: (toolCard: ChatToolCard) => void;
  onDraftChange: (value: string) => void;
  onMemberChange: (memberId: string) => void;
  onSend: () => void;
  selectedMemberId: string;
  toolCards: ChatToolCard[];
};

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function SparkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m11.3 3.7 1.2 3.6a1 1 0 0 0 .6.6l3.6 1.2-3.6 1.2a1 1 0 0 0-.6.6l-1.2 3.6-1.2-3.6a1 1 0 0 0-.6-.6L6.9 9.1l3.6-1.2a1 1 0 0 0 .6-.6l1.2-3.6Z" />
      <path d="m17.5 13.5.7 2a.9.9 0 0 0 .5.5l2 .7-2 .7a.9.9 0 0 0-.5.5l-.7 2-.7-2a.9.9 0 0 0-.5-.5l-2-.7 2-.7a.9.9 0 0 0 .5-.5l.7-2Z" />
    </svg>
  );
}

function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 12h12" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function MicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}

function ClipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m8 12 6.7-6.7a3 3 0 1 1 4.3 4.2L9.5 19a5 5 0 0 1-7-7l8.2-8.2" />
    </svg>
  );
}

export function ChatOverlay({
  draft,
  error,
  isBusy,
  memberOptions,
  messages,
  onAttachmentUpload,
  onAudioUpload,
  onClose,
  onConfirmToolDraft,
  onDraftChange,
  onMemberChange,
  onSend,
  selectedMemberId,
  toolCards,
}: ChatOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  function handleAudioChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    onAudioUpload(file);
    event.target.value = "";
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    onAttachmentUpload(file);
    event.target.value = "";
  }

  return (
    <div
      aria-label="AI 健康助手"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-[#f6f1ea]/85 backdrop-blur-xl"
      role="dialog"
    >
      <input
        aria-label="上传语音"
        className="hidden"
        onChange={handleAudioChange}
        ref={audioInputRef}
        type="file"
        accept="audio/*"
      />
      <input
        aria-label="上传附件"
        className="hidden"
        onChange={handleAttachmentChange}
        ref={attachmentInputRef}
        type="file"
        accept="application/pdf,image/*,application/json,text/plain"
      />

      <div className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-5 py-6 sm:px-6 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-warm-gray/70">Phase 4 Assistant</p>
              <h2 className="mt-2 text-2xl font-bold text-[#2D2926]">对话、抽取与提醒编排</h2>
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-[#2D2926]">
              关注成员
              <select
                className="min-w-44 rounded-full border border-[#E7DDD1] bg-white px-4 py-2 text-sm text-[#2D2926] outline-none focus:border-apple-blue"
                onChange={(event) => onMemberChange(event.target.value)}
                value={selectedMemberId}
              >
                <option value="">暂不指定成员</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            aria-label="关闭 AI 对话"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/70 text-warm-gray shadow-soft transition hover:text-[#2D2926]"
            onClick={onClose}
            type="button"
          >
            <CloseIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-[1.6rem] border border-[#f1d6d6] bg-[#fff5f4] px-4 py-4 text-sm text-[#9a5e5e]">
            {error}
          </div>
        ) : null}

        <div
          className="mx-auto mt-6 flex w-full max-w-4xl flex-1 flex-col gap-5 overflow-y-auto pb-36 outline-none"
          ref={panelRef}
          tabIndex={-1}
        >
          {toolCards.map((toolCard) => (
            <div className="rounded-[2rem] border border-[#E8EDF5] bg-white/90 px-5 py-4 shadow-soft" key={toolCard.id}>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6A7A90]">{toolCard.result.tool_name}</p>
              <p className="mt-3 text-sm leading-7 text-[#2D2926]">{toolCard.result.content}</p>
              {toolCard.result.requires_confirmation && toolCard.result.draft ? (
                <button
                  className="mt-4 inline-flex rounded-full bg-[#2D2926] px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => onConfirmToolDraft(toolCard)}
                  type="button"
                >
                  确认写入档案
                </button>
              ) : null}
            </div>
          ))}

          {messages.map((message) =>
            message.role === "assistant" ? (
              <div className="flex max-w-[85%] items-start gap-4" key={message.id}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/60 text-[#5D92B1] shadow-soft">
                  <SparkIcon aria-hidden className="h-5 w-5" />
                </div>
                <div className="rounded-[2rem] rounded-tl-none border border-white/60 bg-gentle-blue/80 px-5 py-4 shadow-soft">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#2D2926] sm:text-base">{message.content}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-end" key={message.id}>
                <div className="max-w-[82%] rounded-[2rem] rounded-tr-none border border-white/70 bg-white/80 px-5 py-4 shadow-soft">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#4A443F] sm:text-base">{message.content}</p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 bg-gradient-to-t from-warm-cream via-warm-cream to-transparent px-5 py-6 sm:px-6 sm:py-8">
        <div className="pointer-events-auto mx-auto flex max-w-4xl flex-col gap-3 rounded-[2.5rem] border border-white/80 bg-white/95 px-4 py-4 shadow-card">
          <div className="flex items-center gap-3">
            <button
              aria-label="语音输入"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#F2EDE7] bg-warm-cream text-apple-blue transition hover:bg-white"
              onClick={() => audioInputRef.current?.click()}
              type="button"
            >
              <MicIcon aria-hidden className="h-5 w-5" />
            </button>
            <button
              aria-label="添加附件"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#F2EDE7] bg-warm-cream text-[#6A7A90] transition hover:bg-white"
              onClick={() => attachmentInputRef.current?.click()}
              type="button"
            >
              <ClipIcon aria-hidden className="h-5 w-5" />
            </button>
            <input
              className="h-12 min-w-0 flex-1 rounded-full border-none bg-transparent px-3 text-base text-[#2D2926] outline-none placeholder:text-[#B8B0A9]"
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="说说今天家人的健康情况..."
              value={draft}
            />
            <button
              aria-label="发送 AI 消息"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#2D2926] text-white shadow-soft transition hover:bg-[#161412] disabled:opacity-60"
              disabled={isBusy}
              onClick={onSend}
              type="button"
            >
              <SendIcon aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <p className="px-2 text-xs text-warm-gray">
            语音会先转写成文本；附件会先抽取为草稿，再由你确认是否写入正式档案。
          </p>
        </div>
      </div>
    </div>
  );
}
