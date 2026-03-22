import type { AuthSession } from "../auth/session";

import { buildApiUrl, getAuthorized, sendAuthorized } from "./http";


export type AdminSettings = {
  health_summary_refresh_time: string;
  care_plan_refresh_time: string;
  transcription: {
    provider: "openai" | "local_whisper";
    api_key: string | null;
    model: string;
    language: string | null;
    timeout: number;
    local_whisper_model: string;
    local_whisper_device: string;
    local_whisper_compute_type: string;
    local_whisper_download_root: string | null;
  };
  chat_model: {
    base_url: string | null;
    api_key: string | null;
    model: string;
  };
};

type NullablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};

export type AdminSettingsUpdate = Partial<
  Pick<AdminSettings, "health_summary_refresh_time" | "care_plan_refresh_time">
> & {
  transcription?: NullablePatch<AdminSettings["transcription"]>;
  chat_model?: NullablePatch<AdminSettings["chat_model"]>;
};

export function getAdminSettings(session: AuthSession): Promise<AdminSettings> {
  return getAuthorized<AdminSettings>("/api/admin/settings", session);
}

export function updateAdminSettings(
  session: AuthSession,
  payload: AdminSettingsUpdate,
): Promise<AdminSettings> {
  return sendAuthorized<AdminSettings, AdminSettingsUpdate>(
    "/api/admin/settings",
    session,
    {
      method: "PUT",
      payload,
    },
  );
}

export type LocalWhisperModelStatus = {
  present: boolean;
  resolved_path: string | null;
  huggingface_repo_id: string | null;
  message: string | null;
};

export function getLocalWhisperModelStatus(
  session: AuthSession,
  params: { model: string; downloadRoot: string },
): Promise<LocalWhisperModelStatus> {
  const path = buildApiUrl("/api/admin/settings/transcription/local-whisper-model-status");
  const searchParams = new URLSearchParams();
  searchParams.set("model", params.model);
  const root = params.downloadRoot.trim();
  if (root) {
    searchParams.set("download_root", root);
  }
  return getAuthorized<LocalWhisperModelStatus>(
    `${path}?${searchParams.toString()}`,
    session,
  );
}

export function downloadLocalWhisperModel(
  session: AuthSession,
  payload: { model: string; downloadRoot: string },
): Promise<LocalWhisperModelStatus> {
  return sendAuthorized<
    LocalWhisperModelStatus,
    { model: string; download_root: string | null }
  >("/api/admin/settings/transcription/local-whisper-model-download", session, {
    method: "POST",
    payload: {
      model: payload.model,
      download_root: payload.downloadRoot.trim() || null,
    },
  });
}
