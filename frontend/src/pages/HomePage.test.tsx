import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "../auth/session";
import { HomePage } from "./HomePage";

const transcribeAudioMock = vi.fn();
const getDashboardMock = vi.fn();

vi.mock("../api/chat", () => ({
  transcribeAudio: (...args: unknown[]) => transcribeAudioMock(...args),
}));

vi.mock("../api/health", () => ({
  getDashboard: (...args: unknown[]) => getDashboardMock(...args),
}));

vi.mock("../components/ChatInput", () => ({
  ChatInput: ({
    draft,
    isBusy,
    onAudioUpload,
  }: {
    draft: string;
    isBusy: boolean;
    onAudioUpload?: (file: File) => void;
  }) => (
    <div>
      <div data-testid="draft-value">{draft}</div>
      <div data-testid="busy-state">{String(isBusy)}</div>
      <button
        onClick={() =>
          onAudioUpload?.(new File(["voice"], "voice.webm", { type: "audio/webm" }))
        }
        type="button"
      >
        trigger-audio-upload
      </button>
    </div>
  ),
}));

const session: AuthSession = {
  user: {
    id: "user-1",
    family_space_id: "family-1",
    email: "owner@example.com",
    role: "admin",
    created_at: "2026-03-15T08:00:00Z",
  },
  member: {
    id: "member-1",
    family_space_id: "family-1",
    user_account_id: "user-1",
    name: "管理员",
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

describe("HomePage", () => {
  beforeEach(() => {
    transcribeAudioMock.mockReset();
    getDashboardMock.mockReset();
    getDashboardMock.mockResolvedValue({
      members: [],
      today_reminders: [],
      reminder_groups: [],
    });
  });

  it("transcribes uploaded audio into the home composer", async () => {
    transcribeAudioMock.mockResolvedValue({ text: "帮妈妈记录今天血压正常" });

    render(
      <HomePage
        isLoadingMembers={false}
        members={[]}
        membersError={null}
        session={session}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "trigger-audio-upload" }));

    await waitFor(() => {
      expect(transcribeAudioMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("draft-value")).toHaveTextContent(
        "帮妈妈记录今天血压正常",
      );
    });
  });
});
