import type { AuthSession } from "../auth/session";

import { getAuthorized, sendAuthorized } from "./http";


export type AdminSettings = {
  health_summary_refresh_time: string;
  care_plan_refresh_time: string;
};

export function getAdminSettings(session: AuthSession): Promise<AdminSettings> {
  return getAuthorized<AdminSettings>("/api/admin/settings", session);
}

export function updateAdminSettings(
  session: AuthSession,
  payload: AdminSettings,
): Promise<AdminSettings> {
  return sendAuthorized<AdminSettings, AdminSettings>(
    "/api/admin/settings",
    session,
    {
      method: "PUT",
      payload,
    },
  );
}
