import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "../auth/session";
import { getLocalWhisperModelStatus } from "./adminSettings";


const session: AuthSession = {
  user: {
    id: "user-1",
    family_space_id: "family-1",
    username: "admin",
    email: "owner@example.com",
    role: "admin",
    created_at: "2026-03-15T08:00:00Z",
  },
  member: {
    id: "member-1",
    family_space_id: "family-1",
    user_account_id: "user-1",
    name: "Admin",
    gender: "female",
    birth_date: "1990-01-01",
    height_cm: 165,
    blood_type: "O+",
    avatar_url: null,
    created_at: "2026-03-15T08:00:00Z",
    updated_at: "2026-03-15T08:00:00Z",
    permission_level: "manage",
  },
  tokens: {
    access_token: "token",
    refresh_token: "refresh",
    token_type: "bearer",
  },
};

const getAuthorizedMock = vi.fn();

vi.mock("./http", () => ({
  buildApiUrl: (path: string) => path,
  getAuthorized: (...args: unknown[]) => getAuthorizedMock(...args),
  sendAuthorized: vi.fn(),
}));

describe("getLocalWhisperModelStatus", () => {
  beforeEach(() => {
    getAuthorizedMock.mockReset();
    getAuthorizedMock.mockResolvedValue({
      present: false,
      resolved_path: null,
      huggingface_repo_id: "Systran/faster-whisper-small",
      message: "Model not found locally.",
    });
  });

  it("builds a relative probe URL without requiring download_root", async () => {
    await getLocalWhisperModelStatus(session, {
      model: "small",
      downloadRoot: "",
    });

    expect(getAuthorizedMock).toHaveBeenCalledWith(
      "/api/admin/settings/transcription/local-whisper-model-status?model=small",
      session,
    );
  });
});
