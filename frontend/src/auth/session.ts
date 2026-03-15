export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type AuthUser = {
  id: string;
  family_space_id: string;
  email: string;
  role: string;
  created_at: string;
};

export type AuthMember = {
  id: string;
  family_space_id: string;
  user_account_id: string | null;
  name: string;
  gender: string;
  birth_date: string | null;
  blood_type: string | null;
  /** @deprecated 后端已移除，保留以兼容旧数据 */
  allergies?: string[];
  /** @deprecated 后端已移除，保留以兼容旧数据 */
  medical_history?: string[];
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthSession = {
  user: AuthUser;
  member: AuthMember;
  tokens: AuthTokens;
};

export const sessionStorageKey = "homevital.session";

export function readSession(): AuthSession | null {
  const rawValue = window.localStorage.getItem(sessionStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthSession;
  } catch {
    window.localStorage.removeItem(sessionStorageKey);
    return null;
  }
}

export function writeSession(session: AuthSession): void {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(sessionStorageKey);
}
