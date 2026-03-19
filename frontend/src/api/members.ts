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

export type GrantedPermissionLevel = "read" | "write" | "manage";
export type PermissionScope = "specific" | "all";

export type MemberPermissionGrant = {
  id: string;
  member_id: string | null;
  user_account_id: string;
  permission_level: GrantedPermissionLevel;
  target_scope: PermissionScope;
  created_at: string;
  user_email: string;
  user_role: string;
  user_member_id: string | null;
  user_member_name: string | null;
};

type MemberPermissionGrantPayload = {
  user_account_id: string;
  permission_level: GrantedPermissionLevel;
  target_scope: PermissionScope;
};

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

export async function listMemberPermissions(
  session: AuthSession,
  memberId: string,
): Promise<MemberPermissionGrant[]> {
  return getAuthorized<MemberPermissionGrant[]>(
    `/api/members/${memberId}/permissions`,
    session,
  );
}

export async function grantMemberPermission(
  session: AuthSession,
  memberId: string,
  payload: MemberPermissionGrantPayload,
): Promise<MemberPermissionGrant> {
  return sendAuthorized<MemberPermissionGrant, MemberPermissionGrantPayload>(
    `/api/members/${memberId}/permissions`,
    session,
    {
      method: "POST",
      payload,
    },
  );
}

export async function revokeMemberPermission(
  session: AuthSession,
  memberId: string,
  grantId: string,
): Promise<void> {
  await deleteAuthorized(`/api/members/${memberId}/permissions/${grantId}`, session);
}
