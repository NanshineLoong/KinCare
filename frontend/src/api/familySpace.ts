import type { AuthSession } from "../auth/session";

import { apiBaseUrl } from "./client";


export async function deleteFamilySpace(session: AuthSession): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/family-space`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.tokens.access_token}`,
    },
  });

  if (!response.ok) {
    let detail = "请求失败，请稍后再试。";

    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? detail;
    } catch {
      // Keep the fallback message when the response has no body.
    }

    throw new Error(detail);
  }
}
