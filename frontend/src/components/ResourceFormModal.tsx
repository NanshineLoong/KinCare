import { ReactNode, useEffect, useState } from "react";
import { Button } from "./Button";

type ResourceFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  onSubmit: () => void | Promise<void>;
  children: ReactNode;
};

export function ResourceFormModal({
  isOpen,
  onClose,
  title,
  submitLabel = "保存",
  isSubmitting = false,
  onSubmit,
  children,
}: ResourceFormModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = "hidden";
    } else {
      setTimeout(() => setMounted(false), 200);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen && !mounted) return null;

  return (
    <div
      aria-labelledby="form-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-apple-lg transition-all duration-200 ${
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#F2EDE7] px-6 py-4">
          <h2
            className="text-lg font-bold text-[#2D2926]"
            id="form-modal-title"
          >
            {title}
          </h2>
          <button
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-full text-warm-gray transition hover:bg-[#F5F0EA] hover:text-[#2D2926]"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {children}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#F2EDE7] bg-[#F9F6F3] px-6 py-4">
          <Button disabled={isSubmitting} onClick={onClose} variant="secondary">
            取消
          </Button>
          <Button
            loading={isSubmitting}
            onClick={() => {
              void onSubmit();
            }}
            variant="primary"
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
