import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";

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
  thinking?: string;
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

const AUTO_SCROLL_BOTTOM_THRESHOLD = 48;

type ChatOverlayProps = {
  attachments: ComposerAttachment[];
  confirmedToolIds: Set<string>;
  dismissedToolIds: Set<string>;
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
  onDismissToolCard: (toolCard: ChatToolCard) => void;
  onDraftChange: (value: string) => void;
  onMemberChange: (memberId: string) => void;
  onSend: () => void;
  selectedMemberId: string;
  toolCards: ChatToolCard[];
};

function countDraftItems(draft: HealthRecordDraft): number {
  return draft.actions.length;
}

function ActionLabel({ action }: { action: HealthRecordAction }) {
  const { t } = usePreferences();
  if (action.action === "create") return <>{t("chatActionCreate")}</>;
  if (action.action === "update") return <>{t("chatActionUpdate")}</>;
  return <>{t("chatActionDelete")}</>;
}

function ActionSummary({ action }: { action: HealthRecordAction }) {
  const { t } = usePreferences();
  const payload = action.payload ?? {};

  if (action.resource === "observations") {
    const metric = payload.display_name ?? t("chatResourceObservation");
    const value =
      payload.value != null
        ? ` ${payload.value}${payload.unit ?? ""}`
        : payload.value_string
          ? ` ${payload.value_string}${payload.unit ?? ""}`
          : "";
    return <>{`${metric}${value}`}</>;
  }

  if (action.resource === "conditions") {
    return (
      <>
        {payload.display_name
          ? `${payload.display_name}${payload.clinical_status ? ` · ${payload.clinical_status}` : ""}`
          : t("chatResourceCondition")}
      </>
    );
  }

  if (action.resource === "medications") {
    return (
      <>
        {payload.name
          ? `${payload.name}${payload.dosage_description ? ` ${payload.dosage_description}` : ""}`
          : t("chatResourceMedication")}
      </>
    );
  }

  return (
    <>
      {payload.type
        ? `${payload.type}${payload.facility ? ` · ${payload.facility}` : ""}`
        : t("chatResourceEncounter")}
    </>
  );
}

/** Returns true if the content looks like a raw technical error (Python repr / JSON array). */
function isRawTechnicalContent(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith("[{") || trimmed.startsWith("{'") || trimmed.startsWith('[{"');
}

export function ChatOverlay({
  attachments,
  confirmedToolIds,
  dismissedToolIds,
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
  onDismissToolCard,
  onDraftChange,
  onMemberChange,
  onSend,
  selectedMemberId,
  toolCards,
}: ChatOverlayProps) {
  const { t } = usePreferences();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useLayoutEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }
    scrollPanelToBottom(panelRef.current);
  }, [messages, toolCards, isBusy]);

  function handleAudioChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    onAttachmentUpload(file);
    event.target.value = "";
  }

  const chronologicalItems = [
    ...messages.map((message) => ({
      type: "message" as const,
      sortKey: message.sortKey,
      payload: message,
    })),
    ...toolCards.map((toolCard) => ({
      type: "tool" as const,
      sortKey: toolCard.sortKey,
      payload: toolCard,
    })),
  ].sort((a, b) => a.sortKey - b.sortKey);

  function handlePanelScroll() {
    if (!panelRef.current) {
      return;
    }
    shouldAutoScrollRef.current = isPanelNearBottom(panelRef.current);
  }

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
          className="mt-6 min-h-0 w-full flex-1 overflow-y-auto pb-36 outline-none"
          onScroll={handlePanelScroll}
          ref={panelRef}
          tabIndex={-1}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {chronologicalItems.map((item) => {
              if (item.type === "tool") {
                const toolCard = item.payload as ChatToolCard;
                const isConfirmed = confirmedToolIds.has(toolCard.id);
                const isDismissed = dismissedToolIds.has(toolCard.id);

                // Draft card (requires user action)
                if (toolCard.result.requires_confirmation) {
                  return (
                    <DraftCard
                      key={toolCard.id}
                      isConfirmed={isConfirmed}
                      isDismissed={isDismissed}
                      onConfirm={() => onConfirmToolDraft(toolCard)}
                      onDismiss={() => onDismissToolCard(toolCard)}
                      toolCard={toolCard}
                    />
                  );
                }

                // Analysis / suggest card — collapsible inline summary
                return (
                  <AnalysisSummary key={toolCard.id} toolCard={toolCard} />
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

              if (message.role === "assistant") {
                return (
                  <AssistantMessage key={message.id} message={message} isBusy={isBusy} />
                );
              }

              return (
                <div className="flex justify-end" key={message.id}>
                  <div className="max-w-[82%] rounded-[2rem] rounded-tr-none border border-white/50 bg-[rgba(255,255,255,0.95)] shadow-md p-6 backdrop-blur-lg">
                    <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-[#4A443F]">{message.content}</p>
                  </div>
                </div>
              );
            })}

            {isBusy ? <TypingIndicator /> : null}
          </div>
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex max-w-[85%] items-start gap-4">
      <div className="rounded-[2rem] rounded-tl-none bg-transparent p-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#4A6076] [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#4A6076] [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#4A6076]" />
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  isBusy,
}: {
  message: ChatMessage;
  isBusy: boolean;
}) {
  const { t } = usePreferences();
  const isLastMessage = true; // used for thinking pulse — simplified: always pulse if busy + has thinking
  const showThinkingPulse = isBusy && !message.content && message.thinking !== undefined;

  return (
    <div className="flex max-w-[85%] items-start gap-4" key={message.id}>
      <div className="min-w-0 flex-1 rounded-[2rem] rounded-tl-none bg-transparent p-4">
        {message.thinking !== undefined ? (
          <details className="mb-3 group">
            <summary className={`flex cursor-pointer list-none items-center gap-1.5 text-xs text-[#6D8295] select-none ${showThinkingPulse ? "animate-pulse" : ""}`}>
              <span className="material-symbols-outlined text-[14px] transition-transform group-open:rotate-90">
                chevron_right
              </span>
              <span className="font-medium tracking-wide">{t("chatOverlayThinking")}</span>
            </summary>
            {message.thinking ? (
              <div className="mt-2 rounded-xl bg-[#F5F0EA]/60 px-4 py-3">
                <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#6D8295]">
                  {message.thinking}
                </p>
              </div>
            ) : null}
          </details>
        ) : null}
        {message.content ? (
          <MarkdownContent
            className="text-[16px] leading-relaxed text-[#2D2926]"
            content={message.content}
          />
        ) : null}
      </div>
    </div>
  );
}

function AnalysisSummary({ toolCard }: { toolCard: ChatToolCard }) {
  const { t } = usePreferences();
  const rawContent = toolCard.result.content ?? "";
  const displayContent = isRawTechnicalContent(rawContent)
    ? t("chatErrorProcessing")
    : rawContent;

  return (
    <div className="flex max-w-[85%] items-start gap-4">
      <div className="min-w-0 flex-1 p-4">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-[#6D8295] select-none">
            <span className="material-symbols-outlined text-[14px] transition-transform group-open:rotate-90">
              chevron_right
            </span>
            <span className="material-symbols-outlined text-[14px]">analytics</span>
            <span className="font-medium tracking-wide">{t("chatOverlayAnalysisSummary")}</span>
          </summary>
          {displayContent ? (
            <div className="mt-2 rounded-xl bg-[#F5F0EA]/60 px-4 py-3">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#6D8295]">
                {displayContent}
              </p>
            </div>
          ) : null}
        </details>
      </div>
    </div>
  );
}

function DraftCard({
  isConfirmed,
  isDismissed,
  onConfirm,
  onDismiss,
  toolCard,
}: {
  isConfirmed: boolean;
  isDismissed: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  toolCard: ChatToolCard;
}) {
  const { t } = usePreferences();
  const toolDraft = toolCard.result.draft;
  const hasDraftItems = toolDraft && countDraftItems(toolDraft) > 0;
  const itemCount = toolDraft ? countDraftItems(toolDraft) : 0;
  const isResolved = isConfirmed || isDismissed;

  return (
    <div className={`flex max-w-[85%] items-start gap-4 ${isResolved ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1 rounded-[2rem] rounded-tl-none border border-white/40 bg-[rgba(235,242,247,0.45)] p-0 shadow-sm backdrop-blur-lg">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6D8295]">
              {isConfirmed
                ? t("chatDraftConfirmed")
                : isDismissed
                  ? t("chatDraftDismissed")
                  : t("chatOverlayDraft")}
            </p>
            {isConfirmed ? (
              <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            ) : null}
            {isDismissed ? (
              <span className="material-symbols-outlined text-[16px] text-[#6D8295]">block</span>
            ) : null}
          </div>
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
                  <div
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    key={`${action.action}-${action.resource}-${action.record_id ?? index}`}
                  >
                    <input
                      checked
                      className="h-4 w-4 rounded border-[#E7DDD1]"
                      readOnly
                      type="checkbox"
                    />
                    <span className="text-sm text-[#2D2926]">
                      <span className="mr-1 text-[#6D8295]">
                        <ActionLabel action={action} /> ·
                      </span>
                      <ActionSummary action={action} />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {!isResolved ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-full px-4 py-2 text-sm font-medium text-[#4A443F] transition hover:bg-[#F2EDE7]/70"
                  onClick={onDismiss}
                  type="button"
                >
                  {t("chatOverlayDismiss")}
                </button>
                <button
                  className="rounded-full bg-[#2D2926] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#161412]"
                  onClick={onConfirm}
                  type="button"
                >
                  {t("chatOverlayConfirm")}
                </button>
              </div>
            ) : null}
            {hasDraftItems && !isResolved ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#D8E5EF] px-6 py-3">
                <span aria-hidden className="material-symbols-outlined text-[18px] text-[#4A6076]">
                  lightbulb
                </span>
                <span className="text-sm text-[#2D2926]">
                  {t("chatOverlayPendingCount", { count: itemCount })}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isPanelNearBottom(panel: HTMLDivElement): boolean {
  return panel.scrollHeight - panel.scrollTop - panel.clientHeight <= AUTO_SCROLL_BOTTOM_THRESHOLD;
}

function scrollPanelToBottom(panel: HTMLDivElement | null): void {
  if (!panel) {
    return;
  }
  const targetTop = panel.scrollHeight;
  if (typeof panel.scrollTo === "function") {
    panel.scrollTo({ top: targetTop, behavior: "auto" });
    return;
  }
  panel.scrollTop = targetTop;
}
