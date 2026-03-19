import { useEffect, useState } from "react";
import { Button } from "./Button";

type ConfirmDeleteDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  title,
  message = "此操作不可恢复，确定要删除吗？",
  isDeleting = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      setTimeout(() => setMounted(false), 200);
    }
  }, [isOpen]);

  if (!isOpen && !mounted) return null;

  return (
    <div
      aria-labelledby="confirm-delete-title"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
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
        className={`relative w-full max-w-[320px] overflow-hidden rounded-2xl bg-white p-6 shadow-apple-lg transition-all duration-200 ${
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <span className="material-symbols-outlined text-[24px]">
              warning
            </span>
          </div>
          <h2
            className="text-lg font-bold text-[#2D2926]"
            id="confirm-delete-title"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm text-[#7D746D]">{message}</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 relative z-10 pointer-events-auto">
          <Button
            dangerouslySetInnerHTML={{ __html: "确认删除" } as any}
            disabled={isDeleting}
            fullWidth
            loading={isDeleting}
            onClick={(e) => {
              e.stopPropagation();
              void onConfirm();
            }}
            type="button"
            variant="danger"
          >
            确认删除
          </Button>
          <Button 
            disabled={isDeleting} 
            fullWidth 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }} 
            type="button"
            variant="secondary"
          >
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
