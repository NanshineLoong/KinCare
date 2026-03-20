import { useCallback, useEffect, useRef, useState } from "react";

import { parseAttachment } from "../api/chat";
import type { AuthSession } from "../auth/session";
import {
  createPendingAttachment,
  readyAttachmentContexts,
  type ComposerAttachment,
} from "../attachments";

type UseComposerAttachmentsOptions = {
  onError: (message: string) => void;
  onSuggestedText: (value: string) => void;
  session: AuthSession | null;
};

type ActiveUpload = {
  controller: AbortController;
  timerId: number | null;
};

function nextAttachmentId() {
  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAudioFile(file: File) {
  return file.type.startsWith("audio/");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useComposerAttachments({
  onError,
  onSuggestedText,
  session,
}: UseComposerAttachmentsOptions) {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [activeUploadCount, setActiveUploadCount] = useState(0);
  const activeUploadsRef = useRef<Map<string, ActiveUpload>>(new Map());

  const clearUploadTimer = useCallback((id: string) => {
    const activeUpload = activeUploadsRef.current.get(id);
    if (!activeUpload?.timerId) {
      return;
    }
    window.clearInterval(activeUpload.timerId);
    activeUploadsRef.current.set(id, {
      ...activeUpload,
      timerId: null,
    });
  }, []);

  const beginProgress = useCallback((id: string) => {
    const activeUpload = activeUploadsRef.current.get(id);
    if (!activeUpload) {
      return;
    }
    const timerId = window.setInterval(() => {
      setAttachments((current) =>
        current.map((attachment) => {
          if (attachment.id !== id || attachment.status !== "uploading") {
            return attachment;
          }
          const nextProgress = Math.min(
            attachment.progress + Math.max(3, (92 - attachment.progress) * 0.18),
            92,
          );
          return {
            ...attachment,
            progress: nextProgress,
          };
        }),
      );
    }, 180);
    activeUploadsRef.current.set(id, {
      ...activeUpload,
      timerId,
    });
  }, []);

  const finalizeUpload = useCallback((id: string) => {
    const hadActiveUpload = activeUploadsRef.current.has(id);
    clearUploadTimer(id);
    activeUploadsRef.current.delete(id);
    if (hadActiveUpload) {
      setActiveUploadCount((current) => Math.max(0, current - 1));
    }
  }, [clearUploadTimer]);

  const removeAttachment = useCallback((attachmentId: string) => {
    const activeUpload = activeUploadsRef.current.get(attachmentId);
    if (activeUpload) {
      activeUpload.controller.abort();
      clearUploadTimer(attachmentId);
      activeUploadsRef.current.delete(attachmentId);
      setActiveUploadCount((current) => Math.max(0, current - 1));
    }
    setAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
  }, [clearUploadTimer]);

  const clearAttachments = useCallback(() => {
    Array.from(activeUploadsRef.current.keys()).forEach((attachmentId) => {
      removeAttachment(attachmentId);
    });
    setAttachments([]);
  }, [removeAttachment]);

  const restoreAttachments = useCallback((nextAttachments: ComposerAttachment[]) => {
    setAttachments(nextAttachments);
  }, []);

  const uploadAttachment = useCallback(async (file: File) => {
    if (!session) {
      return;
    }

    const attachmentId = nextAttachmentId();
    const controller = new AbortController();
    const showChip = !isAudioFile(file);

    if (showChip) {
      setAttachments((current) => [
        ...current,
        createPendingAttachment(attachmentId, file),
      ]);
    }

    activeUploadsRef.current.set(attachmentId, {
      controller,
      timerId: null,
    });
    setActiveUploadCount((current) => current + 1);
    if (showChip) {
      beginProgress(attachmentId);
    }

    try {
      const result = await parseAttachment(session, file, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }

      if (result.attachment) {
        if (showChip) {
          setAttachments((current) =>
            current.map((attachment) =>
              attachment.id === attachmentId
                ? {
                    ...attachment,
                    filename: result.attachment.filename,
                    mediaType: result.attachment.media_type,
                    status: "ready",
                    progress: 100,
                    context: result.attachment,
                  }
                : attachment,
            ),
          );
        }
      } else if (showChip) {
        setAttachments((current) =>
          current.filter((attachment) => attachment.id !== attachmentId),
        );
      }

      onSuggestedText(result.suggested_text);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return;
      }
      if (showChip) {
        setAttachments((current) =>
          current.filter((attachment) => attachment.id !== attachmentId),
        );
      }
      onError(
        error instanceof Error
          ? error.message
          : "Attachment processing failed. Please try again later.",
      );
    } finally {
      finalizeUpload(attachmentId);
    }
  }, [beginProgress, finalizeUpload, onError, onSuggestedText, session]);

  useEffect(() => {
    return () => {
      activeUploadsRef.current.forEach(({ controller, timerId }) => {
        controller.abort();
        if (timerId) {
          window.clearInterval(timerId);
        }
      });
      activeUploadsRef.current.clear();
    };
  }, []);

  return {
    attachments,
    clearAttachments,
    hasActiveUploads: activeUploadCount > 0,
    readyAttachments: readyAttachmentContexts(attachments),
    removeAttachment,
    restoreAttachments,
    uploadAttachment,
  };
}
