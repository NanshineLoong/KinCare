import type { AuthSession } from "../auth/session";

import { apiBaseUrl } from "./client";
import { sendAuthorized } from "./http";


export type LoginPayload = {
  username: string;
  password: string;
  remember_me?: boolean;
};

export type RegisterPayload = {
  username: string;
  password: string;
  email?: string;
};

export type UserPreferences = {
  preferred_language: "zh" | "en" | null;
};

export type UpdateUserPreferencesPayload = {
  preferred_language?: "zh" | "en" | null;
};

async function parseResponse(response: Response) {
  const data = (await response.json()) as { detail?: string };

  if (!response.ok) {
    throw new Error(data.detail ?? "请求失败，请稍后再试。");
  }

  return data;
}

async function postAuth<TPayload extends object>(path: string, payload: TPayload) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return (await parseResponse(response)) as AuthSession;
}

export function login(payload: LoginPayload) {
  return postAuth("/api/auth/login", payload);
}

export function register(payload: RegisterPayload) {
  return postAuth("/api/auth/register", payload);
}

export function updateUserPreferences(
  session: AuthSession,
  payload: UpdateUserPreferencesPayload,
) {
  return sendAuthorized<UserPreferences, UpdateUserPreferencesPayload>(
    "/api/auth/preferences",
    session,
    {
      method: "PUT",
      payload,
    },
  );
}
