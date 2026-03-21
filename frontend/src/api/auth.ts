import type { AuthSession } from "../auth/session";

import { apiBaseUrl } from "./client";


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
