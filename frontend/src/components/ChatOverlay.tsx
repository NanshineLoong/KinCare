import { useEffect, useRef, useState, type ChangeEvent } from "react";

import type { ChatToolResult, DocumentExtractionDraft } from "../api/chat";


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

function countDraftItems(draft: DocumentExtractionDraft): number {
  return draft.observations.length + draft.care_plans.length;
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
  const [dismissedToolIds, setDismissedToolIds] = useState<Set<string>>(new Set());

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

  const visibleToolCards = toolCards.filter((tc) => !dismissedToolIds.has(tc.id));

  return (
    <div
      aria-label="AI 健康助手"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#f6f1ea]/85 backdrop-blur-xl"
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

      <div className="flex flex-1 flex-col overflow-hidden px-5 py-6 sm:px-6 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          <label className="flex min-w-0 items-center gap-3 text-sm font-medium text-[#2D2926]">
            关注成员
            <select
              className="min-w-44 rounded-full border border-white/40 bg-white/40 px-4 py-2 text-sm text-[#2D2926] outline-none backdrop-blur-md focus:border-apple-blue"
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
          <button
            aria-label="关闭 AI 对话"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/40 shadow-2xl backdrop-blur-xl"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-[1.6rem] border border-[#f1d6d6] bg-[#fff5f4] px-4 py-4 text-sm text-[#9a5e5e]">
            {error}
          </div>
        ) : null}

        <div
          className="mx-auto mt-6 flex w-full max-w-3xl flex-1 flex-col gap-5 overflow-y-auto pb-36 outline-none"
          ref={panelRef}
          tabIndex={-1}
        >
          {visibleToolCards.map((toolCard) => {
            const draft = toolCard.result.draft;
            const hasDraftItems = draft && countDraftItems(draft) > 0;
            const itemCount = draft ? countDraftItems(draft) : 0;

            return (
              <div className="flex max-w-[85%] items-start gap-4" key={toolCard.id}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/40 shadow-sm backdrop-blur-md">
                  <span
                    aria-hidden
                    className="material-symbols-outlined text-[22px] text-[#4A6076]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    front_hand
                  </span>
                </div>
                <div className="min-w-0 flex-1 rounded-[2rem] rounded-tl-none border border-white/40 bg-[rgba(235,242,247,0.45)] p-0 shadow-sm backdrop-blur-lg">
                  <div className="p-6">
                    <p className="text-[16px] leading-relaxed text-[#2D2926]">{toolCard.result.content}</p>
                  </div>
                  {toolCard.result.requires_confirmation && draft ? (
                    <div className="rounded-b-[2rem] border-t border-[#F2EDE7] bg-white/90 p-5 shadow-sm">
                      {hasDraftItems ? (
                        <div className="mb-4 space-y-2">
                          {draft.observations.map((obs, i) => (
                            <label
                              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#F2EDE7]/50"
                              key={`obs-${i}`}
                            >
                              <input checked className="h-4 w-4 rounded border-[#E7DDD1]" readOnly type="checkbox" />
                              <span className="text-sm text-[#2D2926]">
                                {obs.display_name}
                                {obs.value != null ? ` ${obs.value}${obs.unit ?? ""}` : ""}
                              </span>
                            </label>
                          ))}
                          {draft.care_plans.map((cp, i) => (
                            <label
                              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#F2EDE7]/50"
                              key={`cp-${i}`}
                            >
                              <input checked className="h-4 w-4 rounded border-[#E7DDD1]" readOnly type="checkbox" />
                              <span className="text-sm text-[#2D2926]">{cp.title}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          className="rounded-full px-4 py-2 text-sm font-medium text-[#4A443F] transition hover:bg-[#F2EDE7]/70"
                          type="button"
                        >
                          编辑详情
                        </button>
                        <button
                          className="rounded-full px-4 py-2 text-sm font-medium text-[#4A443F] transition hover:bg-[#F2EDE7]/70"
                          onClick={() => setDismissedToolIds((s) => new Set(s).add(toolCard.id))}
                          type="button"
                        >
                          忽略
                        </button>
                        <button
                          className="rounded-full bg-[#2D2926] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#161412]"
                          onClick={() => onConfirmToolDraft(toolCard)}
                          type="button"
                        >
                          确认保存
                        </button>
                      </div>
                      {hasDraftItems ? (
                        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#D8E5EF] px-6 py-3">
                          <span
                            aria-hidden
                            className="material-symbols-outlined text-[18px] text-[#4A6076]"
                          >
                            lightbulb
                          </span>
                          <span className="text-sm text-[#2D2926]">发现 {itemCount} 条可录入数据</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {messages.map((message) =>
            message.role === "assistant" ? (
              <div className="flex max-w-[85%] items-start gap-4" key={message.id}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/40 shadow-sm backdrop-blur-md">
                  <span
                    aria-hidden
                    className="material-symbols-outlined text-[22px] text-[#4A6076]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    front_hand
                  </span>
                </div>
                <div className="rounded-[2rem] rounded-tl-none border border-white/40 bg-[rgba(235,242,247,0.45)] p-6 shadow-sm backdrop-blur-lg">
                  <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-[#2D2926]">{message.content}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-end" key={message.id}>
                <div className="max-w-[82%] rounded-[2rem] rounded-tr-none border border-white/50 bg-[rgba(255,255,255,0.8)] p-6 shadow-sm backdrop-blur-lg">
                  <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-[#4A443F]">{message.content}</p>
                </div>
              </div>
            ),
          )}

          {isBusy ? (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/30 px-4 py-1.5 backdrop-blur-md">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#4A6076]" />
                <span className="text-sm text-[#2D2926]">正在识别健康记录项…</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 bg-gradient-to-t from-[#f6f1ea] via-[#f6f1ea]/90 to-transparent px-5 py-6 sm:px-6 sm:py-8">
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-[2.5rem] border border-white/60 bg-white/95 p-3 pl-6 pr-4 shadow backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              aria-label="添加附件"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#4A443F] transition hover:bg-white/60"
              onClick={() => attachmentInputRef.current?.click()}
              type="button"
            >
              <span aria-hidden className="material-symbols-outlined text-[22px]">add</span>
            </button>
            <button
              aria-label="语音输入"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#4A443F] transition hover:bg-white/60"
              onClick={() => audioInputRef.current?.click()}
              type="button"
            >
              <span aria-hidden className="material-symbols-outlined text-[22px]">mic</span>
            </button>
            <input
              className="min-w-0 flex-1 border-none bg-transparent px-3 text-[16px] text-[#2D2926] outline-none placeholder:text-[#B8B0A9]"
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="说说今天家人的健康情况..."
              value={draft}
            />
            <button
              aria-label="发送 AI 消息"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2D2926] text-white transition hover:bg-[#161412] disabled:opacity-60"
              disabled={isBusy}
              onClick={onSend}
              type="button"
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">arrow_upward</span>
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
