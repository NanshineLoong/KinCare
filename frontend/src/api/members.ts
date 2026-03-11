import type { AuthMember, AuthSession } from "../auth/session";

import { apiBaseUrl } from "./client";


type MemberCreatePayload = {
  name: string;
};

function createHeaders(session: AuthSession, includeJsonContentType = false): HeadersInit {
  return {
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${session.tokens.access_token}`,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T & { detail?: string };

  if (!response.ok) {
    throw new Error(data.detail ?? "请求失败，请稍后再试。");
  }

  return data;
}

export async function listMembers(session: AuthSession): Promise<AuthMember[]> {
  const response = await fetch(`${apiBaseUrl}/api/members`, {
    headers: createHeaders(session),
  });

  return parseResponse<AuthMember[]>(response);
}

export async function createMember(session: AuthSession, payload: MemberCreatePayload): Promise<AuthMember> {
  const response = await fetch(`${apiBaseUrl}/api/members`, {
    method: "POST",
    headers: createHeaders(session, true),
    body: JSON.stringify(payload),
  });

  return parseResponse<AuthMember>(response);
}

export async function deleteMember(session: AuthSession, memberId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/members/${memberId}`, {
    method: "DELETE",
    headers: createHeaders(session),
  });

  await parseResponse<void>(response);
}
