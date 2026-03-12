import type { AuthSession } from "../auth/session";

import { ApiError, buildApiUrl, createAuthHeaders, parseResponse, sendAuthorized, sendAuthorizedFormData } from "./http";


export type ChatSession = {
  id: string;
  user_id: string;
  family_space_id: string;
  member_id: string | null;
  title: string | null;
  page_context: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentExtractionDraft = {
  summary: string;
  observations: Array<{
    category: string;
    code: string;
    display_name: string;
    value: number | null;
    value_string?: string | null;
    unit: string | null;
    effective_at: string;
    notes?: string | null;
    encounter_id?: string | null;
  }>;
  conditions: Array<{
    category: string;
    code: string;
    display_name: string;
    clinical_status: string;
    onset_date?: string | null;
    abatement_date?: string | null;
    severity?: string | null;
    notes?: string | null;
    encounter_id?: string | null;
  }>;
  medications: Array<{
    medication_name: string;
    dosage?: string | null;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
    reason?: string | null;
    prescribed_by?: string | null;
    notes?: string | null;
    encounter_id?: string | null;
  }>;
  encounters: Array<{
    type: string;
    facility?: string | null;
    department?: string | null;
    date: string;
    summary?: string | null;
  }>;
  care_plans: Array<{
    category: string;
    title: string;
    description: string;
    status: string;
    scheduled_at?: string | null;
    completed_at?: string | null;
    generated_by: string;
  }>;
};

export type ChatToolResult = {
  tool_name: string;
  content: string;
  requires_confirmation: boolean;
  draft?: DocumentExtractionDraft | null;
  meta: Record<string, unknown>;
};

export type ChatStreamEvent =
  | { event: "session.started"; data: { session_id: string; member_id: string | null } }
  | { event: "tool.started"; data: { tool_name: string } }
  | { event: "tool.result"; data: ChatToolResult }
  | { event: "message.delta"; data: { content: string } }
  | { event: "message.completed"; data: { content: string } }
  | { event: "error"; data: { detail: string } };

export function createChatSession(
  session: AuthSession,
  payload: { member_id?: string | null; page_context?: string | null },
) {
  return sendAuthorized<ChatSession, { member_id?: string | null; page_context?: string | null }>(
    "/api/chat/sessions",
    session,
    {
      method: "POST",
      payload,
    },
  );
}

export async function transcribeAudio(session: AuthSession, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return sendAuthorizedFormData<{ text: string }>("/api/chat/transcriptions", session, formData);
}

export async function confirmChatDraft(
  session: AuthSession,
  payload: { member_id: string; draft: DocumentExtractionDraft },
) {
  return sendAuthorized<{ created_counts: Record<string, number> }, typeof payload>(
    "/api/chat/confirm",
    session,
    {
      method: "POST",
      payload,
    },
  );
}

export async function streamChatMessage(
  session: AuthSession,
  chatSessionId: string,
  payload: {
    content: string;
    member_id?: string | null;
    document_ids?: string[];
    page_context?: string | null;
  },
): Promise<ChatStreamEvent[]> {
  const response = await fetch(buildApiUrl(`/api/chat/sessions/${chatSessionId}/messages`), {
    method: "POST",
    headers: createAuthHeaders(session, true),
    body: JSON.stringify(payload),
  });

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
