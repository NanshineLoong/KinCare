import { apiBaseUrl } from "../api/client";

import { clearSession, writeSession, type AuthSession, type AuthTokens } from "./session";


type SessionLifecycle = {
  updateSession: (session: AuthSession) => void;
  clearSession: () => void;
};

let sessionSnapshot: AuthSession | null = null;
let sessionLifecycle: SessionLifecycle = {
  updateSession: () => undefined,
  clearSession: () => undefined,
};
let refreshInFlight: Promise<AuthSession | null> | null = null;

function decodeTokenPayload(token: string): { exp?: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(window.atob(`${normalized}${padding}`)) as { exp?: number };
  } catch {
    return null;
  }
}

function getActiveSession(fallbackSession?: AuthSession | null): AuthSession | null {
  return sessionSnapshot ?? fallbackSession ?? null;
}

async function requestRefreshTokens(refreshToken: string): Promise<AuthTokens> {
  const response = await fetch(`${apiBaseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const payload = (await response.json().catch(() => null)) as { detail?: string } | AuthTokens | null;

  if (!response.ok) {
    const error = new Error(
      payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : "请求失败，请稍后再试。",
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload as AuthTokens;
}

function applySession(nextSession: AuthSession) {
  sessionSnapshot = nextSession;
  writeSession(nextSession);
  sessionLifecycle.updateSession(nextSession);
}

function clearManagedSession() {
  sessionSnapshot = null;
  clearSession();
  sessionLifecycle.clearSession();
}

export function configureSessionManager(
  nextSession: AuthSession | null,
  lifecycle: SessionLifecycle,
) {
  sessionSnapshot = nextSession;
  sessionLifecycle = lifecycle;
}

export function getSessionSnapshot() {
  return sessionSnapshot;
}

export function shouldRefreshSession(session: AuthSession, bufferSeconds = 60): boolean {
  const payload = decodeTokenPayload(session.tokens.access_token);
  if (!payload?.exp) {
    return true;
  }
  return payload.exp - Math.floor(Date.now() / 1000) <= bufferSeconds;
}

export async function refreshSession(fallbackSession?: AuthSession | null): Promise<AuthSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const currentSession = getActiveSession(fallbackSession);
  if (!currentSession?.tokens.refresh_token) {
    clearManagedSession();
    return null;
  }

  refreshInFlight = (async () => {
    try {
      const nextTokens = await requestRefreshTokens(currentSession.tokens.refresh_token);
      const nextSession = {
        ...currentSession,
        tokens: nextTokens,
      };
      applySession(nextSession);
      return nextSession;
    } catch (error) {
      const status = error instanceof Error && "status" in error ? (error.status as number | undefined) : undefined;
      if (status === 401 || status === 403) {
        clearManagedSession();
        return null;
      }
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
