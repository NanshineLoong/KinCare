import type { AuthSession } from "../auth/session";

import { apiBaseUrl } from "./client";


export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export function createAuthHeaders(session: AuthSession, includeJsonContentType = false): HeadersInit {
  return {
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${session.tokens.access_token}`,
  };
}

export async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  let detail = "请求失败，请稍后再试。";

  try {
    payload = await response.json();
    if (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string") {
      detail = payload.detail;
    }
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(response.status, detail);
  }

  return payload as T;
}

export async function getAuthorized<T>(path: string, session: AuthSession): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    headers: createAuthHeaders(session),
  });

  return parseResponse<T>(response);
}

export async function sendAuthorized<TResponse, TPayload extends object>(
  path: string,
  session: AuthSession,
  options: {
    method: "POST" | "PUT";
    payload: TPayload;
  },
): Promise<TResponse> {
  const response = await fetch(buildApiUrl(path), {
    method: options.method,
    headers: createAuthHeaders(session, true),
    body: JSON.stringify(options.payload),
  });

  return parseResponse<TResponse>(response);
}

export async function deleteAuthorized(path: string, session: AuthSession): Promise<void> {
  const response = await fetch(buildApiUrl(path), {
    method: "DELETE",
    headers: createAuthHeaders(session),
  });

  await parseResponse<void>(response);
}

export async function sendAuthorizedFormData<TResponse>(
  path: string,
  session: AuthSession,
  formData: FormData,
): Promise<TResponse> {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: createAuthHeaders(session),
    body: formData,
  });

  return parseResponse<TResponse>(response);
}
