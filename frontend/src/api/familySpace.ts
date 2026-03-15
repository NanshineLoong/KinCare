import type { AuthSession } from "../auth/session";

import { authorizedFetch } from "./http";


export async function deleteFamilySpace(session: AuthSession): Promise<void> {
  const response = await authorizedFetch("/api/family-space", session, {
    method: "DELETE",
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
