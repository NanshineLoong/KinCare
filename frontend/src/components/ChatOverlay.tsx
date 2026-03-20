import { useEffect, useRef, useState, type ChangeEvent } from "react";

import type {
  ChatToolResult,
  HealthRecordAction,
  HealthRecordDraft,
} from "../api/chat";
import type { ComposerAttachment } from "../attachments";
import { usePreferences } from "../preferences";
import { ChatInput } from "./ChatInput";
import { MarkdownContent } from "./MarkdownContent";

export type ChatMessage = {
  id: string;
  role: "assistant" | "system" | "user";
  content: string;
  sortKey: number;
};

export type ChatToolCard = {
  id: string;
  result: ChatToolResult;
  sortKey: number;
};

type MemberOption = {
  id: string;
  name: string;
};

type ChatOverlayProps = {
  attachments: ComposerAttachment[];
  draft: string;
  error: string | null;
  isBusy: boolean;
  isUploading: boolean;
  memberOptions: MemberOption[];
  messages: ChatMessage[];
  onAttachmentRemove: (attachmentId: string) => void;
  onAttachmentUpload: (file: File) => void;
  onClose: () => void;
  onConfirmToolDraft: (toolCard: ChatToolCard) => void;
  onDraftChange: (value: string) => void;
  onMemberChange: (memberId: string) => void;
  onSend: () => void;
  selectedMemberId: string;
  toolCards: ChatToolCard[];
};

function countDraftItems(draft: HealthRecordDraft): number {
  return draft.actions.length;
}

function actionLabel(action: HealthRecordAction): string {
  if (action.action === "create") {
    return "新增";
  }
  if (action.action === "update") {
    return "更新";
  }
  return "删除";
}

function actionSummary(action: HealthRecordAction): string {
  const payload = action.payload ?? {};

  if (action.resource === "observations") {
    const metric = payload.display_name ?? "指标记录";
    const value =
      payload.value != null
        ? ` ${payload.value}${payload.unit ?? ""}`
        : payload.value_string
          ? ` ${payload.value_string}${payload.unit ?? ""}`
          : "";
    return `${metric}${value}`;
  }

  if (action.resource === "conditions") {
    return payload.display_name ? `${payload.display_name}${payload.clinical_status ? ` · ${payload.clinical_status}` : ""}` : "健康状况";
  }

  if (action.resource === "medications") {
    return payload.name ? `${payload.name}${payload.dosage_description ? ` ${payload.dosage_description}` : ""}` : "用药记录";
  }

  return payload.type ? `${payload.type}${payload.facility ? ` · ${payload.facility}` : ""}` : "就诊记录";
}

export function ChatOverlay({
  attachments,
  draft,
  error,
  isBusy,
  isUploading,
  memberOptions,
  messages,
  onAttachmentRemove,
  onAttachmentUpload,
  onClose,
  onConfirmToolDraft,
  onDraftChange,
  onMemberChange,
  onSend,
  selectedMemberId,
  toolCards,
}: ChatOverlayProps) {
  const { t } = usePreferences();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [dismissedToolIds, setDismissedToolIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  function handleAudioChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    onAttachmentUpload(file);
    event.target.value = "";
  }

  const visibleToolCards = toolCards.filter((toolCard) => !dismissedToolIds.has(toolCard.id));

  const chronologicalItems = [
    ...messages.map((message) => ({
      type: "message" as const,
      sortKey: message.sortKey,
      payload: message,
    })),
    ...visibleToolCards.map((toolCard) => ({
      type: "tool" as const,
      sortKey: toolCard.sortKey,
      payload: toolCard,
    })),
  ].sort((a, b) => a.sortKey - b.sortKey);

  return (
    <div
      aria-label={t("chatOverlayLabel")}
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#f6f1ea]/85 backdrop-blur-xl"
      role="dialog"
    >
      <input
        aria-label={t("chatOverlayUploadAudio")}
        className="hidden"
        onChange={handleAudioChange}
        ref={audioInputRef}
        type="file"
        accept="audio/*"
      />

      <div className="flex flex-1 flex-col overflow-hidden px-5 py-6 sm:px-6 sm:py-8">
        <div className="flex items-start justify-end gap-4">
          <button
            aria-label={t("chatOverlayClose")}
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
          {chronologicalItems.map((item) => {
            if (item.type === "tool") {
              const toolCard = item.payload as ChatToolCard;
              const toolDraft = toolCard.result.draft;
              const hasDraftItems = toolDraft && countDraftItems(toolDraft) > 0;
              const itemCount = toolDraft ? countDraftItems(toolDraft) : 0;

              return (
                <div className="flex max-w-[85%] items-start gap-4" key={toolCard.id}>
                  <div className="min-w-0 flex-1 rounded-[2rem] rounded-tl-none border border-white/40 bg-[rgba(235,242,247,0.45)] p-0 shadow-sm backdrop-blur-lg">
                    <div className="p-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6D8295]">
                        {toolCard.result.requires_confirmation
                          ? t("chatOverlayDraft")
                          : t("chatOverlayAnalysis")}
                      </p>
                      <p className="text-[16px] leading-relaxed text-[#2D2926]">{toolCard.result.content}</p>
                      {toolCard.result.suggestion_summary ? (
                        <p className="mt-3 text-sm text-[#5E768C]">{toolCard.result.suggestion_summary}</p>
                      ) : null}
                    </div>
                    {toolDraft ? (
                      <div className="rounded-b-[2rem] border-t border-[#F2EDE7] bg-white/90 p-5 shadow-sm">
                        {hasDraftItems ? (
                          <div className="mb-4 space-y-2">
                            {toolDraft.actions.map((action, index) => (
                              <label
                                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#F2EDE7]/50"
                                key={`${action.action}-${action.resource}-${action.record_id ?? index}`}
                              >
                                <input checked className="h-4 w-4 rounded border-[#E7DDD1]" readOnly type="checkbox" />
                                <span className="text-sm text-[#2D2926]">
                                  <span className="mr-1 text-[#6D8295]">{actionLabel(action)} ·</span>
                                  <span>{actionSummary(action)}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            className="rounded-full px-4 py-2 text-sm font-medium text-[#4A443F] transition hover:bg-[#F2EDE7]/70"
                            onClick={() => setDismissedToolIds((current) => new Set(current).add(toolCard.id))}
                            type="button"
                          >
                            忽略
                          </button>
                          {toolCard.result.requires_confirmation ? (
                            <button
                              className="rounded-full bg-[#2D2926] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#161412]"
                              onClick={() => onConfirmToolDraft(toolCard)}
                              type="button"
                            >
                              确认保存
                            </button>
                          ) : null}
                        </div>
                        {hasDraftItems ? (
                          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#D8E5EF] px-6 py-3">
                            <span aria-hidden className="material-symbols-outlined text-[18px] text-[#4A6076]">
                              lightbulb
                            </span>
                            <span className="text-sm text-[#2D2926]">发现 {itemCount} 条待处理档案操作</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }

            const message = item.payload as ChatMessage;
            if (message.role === "system") {
              return (
                <div className="flex justify-center" key={message.id}>
                  <div className="rounded-full bg-[#F5F0EA] px-4 py-2 text-xs font-semibold text-[#6D8295]">
                    {message.content}
                  </div>
                </div>
              );
            }
            return message.role === "assistant" ? (
              <div className="flex max-w-[85%] items-start gap-4" key={message.id}>
                <div className="rounded-[2rem] rounded-tl-none bg-transparent p-4">
                  <MarkdownContent
                    className="text-[16px] leading-relaxed text-[#2D2926]"
                    content={message.content}
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-end" key={message.id}>
                <div className="max-w-[82%] rounded-[2rem] rounded-tr-none border border-white/50 bg-[rgba(255,255,255,0.95)] shadow-md p-6 backdrop-blur-lg">
                  <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-[#4A443F]">{message.content}</p>
                </div>
              </div>
            );
          })}

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

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-[#f6f1ea] via-[#f6f1ea]/90 to-transparent px-5 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput
            attachments={attachments}
            draft={draft}
            isBusy={isBusy}
            isUploading={isUploading}
            memberOptions={memberOptions}
            onAttachmentRemove={onAttachmentRemove}
            onAttachmentUpload={onAttachmentUpload}
            onDraftChange={onDraftChange}
            onMemberChange={onMemberChange}
            onSend={onSend}
            selectedMemberId={selectedMemberId}
          />
        </div>
      </div>
    </div>
  );
}
