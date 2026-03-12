import type { AuthMember, AuthSession } from "../auth/session";

import {
  buildApiUrl,
  createAuthHeaders,
  deleteAuthorized,
  parseResponse,
  sendAuthorized,
} from "./http";


type MemberCreatePayload = {
  name: string;
};

type MemberUpdatePayload = Partial<{
  name: string;
  gender: string;
  birth_date: string | null;
  blood_type: string | null;
  allergies: string[];
  medical_history: string[];
  avatar_url: string | null;
}>;

export async function listMembers(session: AuthSession): Promise<AuthMember[]> {
  const response = await fetch(buildApiUrl("/api/members"), {
    headers: createAuthHeaders(session),
  });

  return parseResponse<AuthMember[]>(response);
}

export async function createMember(session: AuthSession, payload: MemberCreatePayload): Promise<AuthMember> {
  return sendAuthorized<AuthMember, MemberCreatePayload>("/api/members", session, {
    method: "POST",
    payload,
  });
}

export async function getMember(session: AuthSession, memberId: string): Promise<AuthMember> {
  const response = await fetch(buildApiUrl(`/api/members/${memberId}`), {
    headers: createAuthHeaders(session),
  });

  return parseResponse<AuthMember>(response);
}

export async function updateMember(
  session: AuthSession,
  memberId: string,
  payload: MemberUpdatePayload,
): Promise<AuthMember> {
  return sendAuthorized<AuthMember, MemberUpdatePayload>(`/api/members/${memberId}`, session, {
    method: "PUT",
    payload,
  });
}

export async function deleteMember(session: AuthSession, memberId: string): Promise<void> {
  await deleteAuthorized(`/api/members/${memberId}`, session);
}
