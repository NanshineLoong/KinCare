import type { AuthSession } from "../auth/session";
import { getSessionSnapshot, refreshSession } from "../auth/sessionManager";

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

function mergeHeaders(baseHeaders?: HeadersInit, authHeaders?: HeadersInit): Headers {
  const headers = new Headers(baseHeaders);
  if (authHeaders) {
    new Headers(authHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

export async function authorizedFetch(
  path: string,
  session: AuthSession,
  init: RequestInit = {},
): Promise<Response> {
  const activeSession = getSessionSnapshot() ?? session;
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: mergeHeaders(init.headers, createAuthHeaders(activeSession)),
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshedSession = await refreshSession(activeSession);
  if (!refreshedSession) {
    return response;
  }

  return fetch(buildApiUrl(path), {
    ...init,
    headers: mergeHeaders(init.headers, createAuthHeaders(refreshedSession)),
  });
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
  const response = await authorizedFetch(path, session);
  return parseResponse<T>(response);
}

export async function sendAuthorized<TResponse, TPayload extends object>(
  path: string,
  session: AuthSession,
  options: {
    method: "POST" | "PUT";
    payload: TPayload;
    signal?: AbortSignal;
  },
): Promise<TResponse> {
  const response = await authorizedFetch(path, session, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.payload),
    signal: options.signal,
  });

  return parseResponse<TResponse>(response);
}

export async function deleteAuthorized(path: string, session: AuthSession): Promise<void> {
  const response = await authorizedFetch(path, session, {
    method: "DELETE",
  });

  await parseResponse<void>(response);
}

export async function sendAuthorizedFormData<TResponse>(
  path: string,
  session: AuthSession,
  formData: FormData,
  options?: {
    signal?: AbortSignal;
  },
): Promise<TResponse> {
  const response = await authorizedFetch(path, session, {
    method: "POST",
    body: formData,
    signal: options?.signal,
  });

  return parseResponse<TResponse>(response);
}
