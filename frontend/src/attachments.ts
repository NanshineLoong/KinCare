import type { ChatAttachmentContext } from "./api/chat";

export type ComposerAttachmentStatus = "uploading" | "ready";

export type ComposerAttachment = {
  id: string;
  filename: string;
  mediaType: string;
  status: ComposerAttachmentStatus;
  progress: number;
  context: ChatAttachmentContext | null;
};

export function createPendingAttachment(
  id: string,
  file: File,
): ComposerAttachment {
  return {
    id,
    filename: file.name,
    mediaType: file.type || "application/octet-stream",
    status: "uploading",
    progress: 6,
    context: null,
  };
}

export function readyAttachmentContexts(
  attachments: ComposerAttachment[],
): ChatAttachmentContext[] {
  return attachments.flatMap((attachment) =>
    attachment.status === "ready" && attachment.context
      ? [attachment.context]
      : [],
  );
}

export function hasPendingAttachments(
  attachments: ComposerAttachment[],
): boolean {
  return attachments.some((attachment) => attachment.status === "uploading");
}

export function hasReadyAttachments(
  attachments: ComposerAttachment[],
): boolean {
  return attachments.some(
    (attachment) => attachment.status === "ready" && attachment.context,
  );
}
