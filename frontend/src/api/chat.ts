import type { AuthSession } from "../auth/session";

import {
  ApiError,
  authorizedFetch,
  getAuthorized,
  parseResponse,
  sendAuthorized,
  sendAuthorizedFormData,
} from "./http";

export type ChatSession = {
  id: string;
  user_id: string;
  family_space_id: string;
  member_id: string | null;
  title: string | null;
  summary: string | null;
  page_context: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatSessionListItem = {
  id: string;
  member_id: string | null;
  title: string | null;
  summary: string | null;
  updated_at: string;
};

export type HealthRecordAction = {
  action: "create" | "update" | "delete";
  resource: "observations" | "conditions" | "medications" | "encounters";
  target_member_id: string;
  record_id?: string | null;
  payload?: {
    category?: string;
    code?: string;
    display_name?: string;
    value?: number | null;
    value_string?: string | null;
    unit?: string | null;
    context?: string | null;
    effective_at?: string;
    clinical_status?: string;
    onset_date?: string | null;
    notes?: string | null;
    name?: string;
    indication?: string | null;
    dosage_description?: string | null;
    status?: string;
    start_date?: string | null;
    end_date?: string | null;
    type?: string;
    facility?: string | null;
    department?: string | null;
    attending_physician?: string | null;
    date?: string;
    summary?: string | null;
  } | null;
};

export type HealthRecordDraft = {
  summary: string;
  actions: HealthRecordAction[];
};

export type ChatAttachmentContext = {
  filename: string;
  media_type: string;
  source_type: string;
  ocr_used: boolean;
  excerpt: string;
  markdown_excerpt?: string | null;
};

export type ChatAttachmentUploadResult = {
  attachment: ChatAttachmentContext | null;
  suggested_text: string;
};

export type ChatToolResult = {
  tool_name: string;
  content: string;
  requires_confirmation?: boolean;
  tool_call_id?: string | null;
  draft?: HealthRecordDraft | null;
  suggestion_summary?: string;
  meta?: Record<string, unknown>;
};

export type ChatStreamEvent =
  | {
      event: "session.started";
      data: {
        session_id: string;
        member_id: string | null;
        member_name?: string | null;
        previous_member_id?: string | null;
        previous_member_name?: string | null;
        focus_changed?: boolean;
        resolution_source?: "explicit" | "inferred" | "carried" | "unresolved";
      };
    }
  | { event: "tool.started"; data: { tool_name: string } }
  | { event: "tool.result"; data: ChatToolResult }
  | { event: "tool.draft"; data: ChatToolResult }
  | { event: "tool.suggest"; data: ChatToolResult }
  | { event: "tool.error"; data: { tool_name: string; error: string } }
  | { event: "message.delta"; data: { content: string } }
  | { event: "message.thinking"; data: { content: string } }
  | { event: "message.completed"; data: { content: string } };

export type ChatMessageRead = {
  id: string;
  role: string;
  content: string;
  event_type?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export function listChatMessages(
  session: AuthSession,
  sessionId: string,
): Promise<ChatMessageRead[]> {
  return getAuthorized<ChatMessageRead[]>(
    `/api/chat/sessions/${sessionId}/messages`,
    session,
  );
}

export function listChatSessions(
  session: AuthSession,
  params?: { limit?: number; offset?: number },
): Promise<ChatSessionListItem[]> {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  return getAuthorized<ChatSessionListItem[]>(
    `/api/chat/sessions?limit=${limit}&offset=${offset}`,
    session,
  );
}

export function createChatSession(
  session: AuthSession,
  payload: { member_id?: string | null; page_context?: string | null },
) {
  return sendAuthorized<
    ChatSession,
    { member_id?: string | null; page_context?: string | null }
  >("/api/chat/sessions", session, {
    method: "POST",
    payload,
  });
}

export async function transcribeAudio(session: AuthSession, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return sendAuthorizedFormData<{ text: string }>(
    "/api/chat/transcriptions",
    session,
    formData,
  );
}

export async function parseAttachment(
  session: AuthSession,
  file: File,
  options?: {
    signal?: AbortSignal;
  },
) {
  const formData = new FormData();
  formData.append("file", file);
  return sendAuthorizedFormData<ChatAttachmentUploadResult>(
    "/api/chat/attachments",
    session,
    formData,
    {
      signal: options?.signal,
    },
  );
}

export async function confirmChatDraft(
  session: AuthSession,
  chatSessionId: string,
  payload: {
    approvals: Record<string, boolean>;
    edits: Record<string, HealthRecordDraft>;
  },
) {
  return sendAuthorized<
    { created_counts: Record<string, number>; assistant_message: string },
    typeof payload
  >(`/api/chat/${chatSessionId}/confirm-draft`, session, {
    method: "POST",
    payload,
  });
}

export async function streamChatMessage(
  session: AuthSession,
  chatSessionId: string,
  payload: {
    content: string;
    language: "zh" | "en";
    member_id?: string | null;
    member_selection_mode?: "explicit" | "auto";
    page_context?: string | null;
    attachments?: ChatAttachmentContext[];
  },
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
): Promise<void> {
  const response = await authorizedFetch(
    `/api/chat/sessions/${chatSessionId}/messages`,
    session,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    await parseResponse<ApiError>(response);
  }

  if (!response.body) {
    const rawText = await response.text();
    await emitParsedBlocks(rawText, onEvent);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split("\n\n");
    buffer = segments.pop() ?? "";
    await emitParsedBlocks(segments.join("\n\n"), onEvent);
  }

  buffer += decoder.decode();
  await emitParsedBlocks(buffer, onEvent);
}

async function emitParsedBlocks(
  rawText: string,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
) {
  const blocks = rawText.split("\n\n").filter((item) => item.trim().length > 0);
  for (const block of blocks) {
    const parsed = parseSseBlock(block);
    if (!parsed) {
      continue;
    }
    await onEvent(parsed);
  }
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  let eventName = "";
  let dataText = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataText = line.slice("data:".length).trim();
    }
  }

  if (!eventName || !dataText) {
    return null;
  }

  return {
    event: eventName,
    data: JSON.parse(dataText),
  } as ChatStreamEvent;
}
