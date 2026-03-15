import { useEffect, type ReactNode } from "react";

type ModalSize = "sm" | "md" | "lg" | "xl" | "member-sheet";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  showClose?: boolean;
  footer?: ReactNode;
  className?: string;
};

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm w-full",
  md: "max-w-lg w-full",
  lg: "max-w-2xl w-full",
  xl: "max-w-4xl w-full",
  "member-sheet": "w-[75vw] h-[85vh]",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  showClose = true,
  footer,
  className = "",
}: ModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm bg-[rgba(45,41,38,0.15)]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={[
          "relative flex flex-col bg-white rounded-panel shadow-2xl border border-white/50 overflow-hidden",
          size === "member-sheet" ? "max-h-[85vh]" : "max-h-[90vh]",
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Header */}
        {(title || showClose) && (
          <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-8 py-5">
            {title && (
              <div className="text-xl font-bold text-[#2D2926]">{title}</div>
            )}
            {showClose && (
              <button
                type="button"
                aria-label="关闭"
                onClick={onClose}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-warm-gray transition hover:bg-[#F5F0EA] hover:text-[#2D2926]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </header>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <footer className="shrink-0 border-t border-gray-100 px-8 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
