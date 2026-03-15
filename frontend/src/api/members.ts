import type { AuthMember, AuthSession } from "../auth/session";

import { deleteAuthorized, getAuthorized, sendAuthorized } from "./http";


type MemberCreatePayload = {
  name: string;
  gender?: string;
};

type MemberUpdatePayload = Partial<{
  name: string;
  gender: string;
  birth_date: string | null;
  height_cm: number | null;
  blood_type: string | null;
  avatar_url: string | null;
}>;

export async function listMembers(session: AuthSession): Promise<AuthMember[]> {
  return getAuthorized<AuthMember[]>("/api/members", session);
}

export async function createMember(session: AuthSession, payload: MemberCreatePayload): Promise<AuthMember> {
  return sendAuthorized<AuthMember, MemberCreatePayload>("/api/members", session, {
    method: "POST",
    payload,
  });
}

export async function getMember(session: AuthSession, memberId: string): Promise<AuthMember> {
  return getAuthorized<AuthMember>(`/api/members/${memberId}`, session);
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
