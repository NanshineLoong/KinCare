import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "../auth/session";
import { PreferencesProvider } from "../preferences";
import { HomePage } from "./HomePage";

const parseAttachmentMock = vi.fn();
const getDashboardMock = vi.fn();
const refreshDashboardTodayRemindersMock = vi.fn();
const refreshMemberHealthSummariesMock = vi.fn();

vi.mock("../api/chat", () => ({
  parseAttachment: (...args: unknown[]) => parseAttachmentMock(...args),
}));

vi.mock("../api/health", () => ({
  getDashboard: (...args: unknown[]) => getDashboardMock(...args),
  refreshDashboardTodayReminders: (...args: unknown[]) =>
    refreshDashboardTodayRemindersMock(...args),
  refreshMemberHealthSummaries: (...args: unknown[]) =>
    refreshMemberHealthSummariesMock(...args),
}));

vi.mock("../components/ChatInput", () => ({
  ChatInput: ({
    draft,
    isBusy,
    onAttachmentUpload,
  }: {
    draft: string;
    isBusy: boolean;
    onAttachmentUpload?: (file: File) => void;
  }) => (
    <div>
      <div data-testid="draft-value">{draft}</div>
      <div data-testid="busy-state">{String(isBusy)}</div>
      <button
        onClick={() =>
          onAttachmentUpload?.(new File(["pdf"], "report.pdf", { type: "application/pdf" }))
        }
        type="button"
      >
        trigger-attachment-upload
      </button>
    </div>
  ),
}));

const session: AuthSession = {
  user: {
    id: "user-1",
    family_space_id: "family-1",
    username: "管理员",
    email: "owner@example.com",
    preferred_language: null,
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
    parseAttachmentMock.mockReset();
    getDashboardMock.mockReset();
    refreshDashboardTodayRemindersMock.mockReset();
    refreshMemberHealthSummariesMock.mockReset();
    getDashboardMock.mockResolvedValue({
      members: [],
      today_reminders: [],
      reminder_groups: [],
    });
  });

  it("parses uploaded attachments into the home composer", async () => {
    parseAttachmentMock.mockResolvedValue({
      attachment: {
        filename: "report.pdf",
        media_type: "application/pdf",
        source_type: "docling",
        ocr_used: false,
        excerpt: "收缩压 126mmHg，早餐后服药。",
        markdown_excerpt: "## 关键结论\n收缩压 126mmHg，早餐后服药。",
      },
      suggested_text: "我上传了附件《report.pdf》，请结合其中内容继续分析。",
    });

    render(
      <PreferencesProvider>
        <HomePage
          isLoadingMembers={false}
          members={[]}
          membersError={null}
          session={session}
        />
      </PreferencesProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "trigger-attachment-upload" }));

    await waitFor(() => {
      expect(parseAttachmentMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("draft-value")).toHaveTextContent(
        "我上传了附件《report.pdf》，请结合其中内容继续分析。",
      );
    });
  });

  it("renders a single untitled placeholder when a member has no summaries", async () => {
    getDashboardMock.mockResolvedValue({
      members: [
        {
          member: {
            id: "member-2",
            name: "张妈妈",
            gender: "female",
            avatar_url: null,
            blood_type: "A+",
          },
          health_summaries: [],
        },
      ],
      today_reminders: [],
      reminder_groups: [],
    });

    render(
      <PreferencesProvider>
        <HomePage
          isLoadingMembers={false}
          members={[
            {
              id: "member-2",
              family_space_id: "family-1",
              user_account_id: null,
              name: "张妈妈",
              gender: "female",
              birth_date: "1958-04-12",
              height_cm: 158,
              blood_type: "A+",
              avatar_url: null,
              created_at: "2026-03-15T08:00:00Z",
              updated_at: "2026-03-15T08:00:00Z",
              permission_level: "read",
            },
          ]}
          membersError={null}
          session={session}
        />
      </PreferencesProvider>,
    );

    expect(await screen.findByText("期待新纪录")).toBeInTheDocument();
    expect(screen.queryByText("慢病管理")).not.toBeInTheDocument();
    expect(screen.queryByText("生活习惯")).not.toBeInTheDocument();
    expect(screen.queryByText("生理指标")).not.toBeInTheDocument();
  });
});
