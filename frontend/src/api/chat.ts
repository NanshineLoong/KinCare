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
      data: { session_id: string; member_id: string | null };
    }
  | { event: "tool.started"; data: { tool_name: string } }
  | { event: "tool.result"; data: ChatToolResult }
  | { event: "tool.draft"; data: ChatToolResult }
  | { event: "tool.suggest"; data: ChatToolResult }
  | { event: "tool.error"; data: { tool_name: string; error: string } }
  | { event: "message.delta"; data: { content: string } }
  | { event: "message.completed"; data: { content: string } };

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
    member_id?: string | null;
    page_context?: string | null;
  },
): Promise<ChatStreamEvent[]> {
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

  const rawText = await response.text();
  const blocks = rawText.split("\n\n").filter((item) => item.trim().length > 0);
  const events: ChatStreamEvent[] = [];

  for (const block of blocks) {
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
      continue;
    }
    events.push({
      event: eventName,
      data: JSON.parse(dataText),
    } as ChatStreamEvent);
  }
  return events;
}
