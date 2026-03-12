import { useEffect, useRef, type SVGProps } from "react";


export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type ChatOverlayProps = {
  draft: string;
  messages: ChatMessage[];
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
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

export function ChatOverlay({ draft, messages, onClose, onDraftChange, onSend }: ChatOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      aria-label="AI 健康助手"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-[#f6f1ea]/85 backdrop-blur-xl"
      role="dialog"
    >
      <div className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-5 py-6 sm:px-6 sm:py-8">
        <div className="flex justify-end">
          <button
            aria-label="关闭 AI 对话"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/70 text-warm-gray shadow-soft transition hover:text-[#2D2926]"
            onClick={onClose}
            type="button"
          >
            <CloseIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div
          className="mx-auto mt-6 flex w-full max-w-3xl flex-1 flex-col gap-5 overflow-y-auto pb-32 outline-none"
          ref={panelRef}
          tabIndex={-1}
        >
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
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-[2.5rem] border border-white/80 bg-white/95 px-4 py-3 shadow-card">
          <input
            className="h-12 min-w-0 flex-1 rounded-full border-none bg-transparent px-3 text-base text-[#2D2926] outline-none placeholder:text-[#B8B0A9]"
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="说说今天家人的健康情况..."
            value={draft}
          />
          <button
            aria-label="发送 AI 消息"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#2D2926] text-white shadow-soft transition hover:bg-[#161412]"
            onClick={onSend}
            type="button"
          >
            <SendIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
