import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "../preferences";
import type { MemberPermissionGrant } from "../api/members";
import type { AuthMember, AuthSession } from "../auth/session";
import { SettingsSheet } from "./SettingsSheet";

const createMemberMock = vi.fn();
const listMemberPermissionsMock = vi.fn();
const grantMemberPermissionMock = vi.fn();
const revokeMemberPermissionMock = vi.fn();
const getAdminSettingsMock = vi.fn();
const updateAdminSettingsMock = vi.fn();
const getLocalWhisperModelStatusMock = vi.fn();
const downloadLocalWhisperModelMock = vi.fn();

vi.mock("../api/members", () => ({
  createMember: (...args: unknown[]) => createMemberMock(...args),
  deleteMember: vi.fn(),
  listMemberPermissions: (...args: unknown[]) => listMemberPermissionsMock(...args),
  grantMemberPermission: (...args: unknown[]) => grantMemberPermissionMock(...args),
  revokeMemberPermission: (...args: unknown[]) => revokeMemberPermissionMock(...args),
}));

vi.mock("../api/adminSettings", () => ({
  getAdminSettings: (...args: unknown[]) => getAdminSettingsMock(...args),
  updateAdminSettings: (...args: unknown[]) => updateAdminSettingsMock(...args),
  getLocalWhisperModelStatus: (...args: unknown[]) =>
    getLocalWhisperModelStatusMock(...args),
  downloadLocalWhisperModel: (...args: unknown[]) =>
    downloadLocalWhisperModelMock(...args),
}));

const deleteFamilySpaceMock = vi.fn();

vi.mock("../api/familySpace", () => ({
  deleteFamilySpace: (...args: unknown[]) => deleteFamilySpaceMock(...args),
}));

const adminSession: AuthSession = {
  user: {
    id: "user-1",
    family_space_id: "family-1",
    username: "管理员",
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

const memberSession: AuthSession = {
  ...adminSession,
  user: {
    ...adminSession.user,
    id: "user-2",
    username: "张妈妈",
    email: "member@example.com",
    role: "member",
  },
  member: {
    id: "member-2",
    family_space_id: "family-1",
    user_account_id: "user-2",
    name: "张妈妈",
    gender: "female",
    birth_date: "1958-04-12",
    height_cm: 158,
    blood_type: "A+",
    avatar_url: null,
    created_at: "2026-03-15T08:00:00Z",
    updated_at: "2026-03-15T08:00:00Z",
    permission_level: "write",
  },
};

const members: AuthMember[] = [
  {
    ...adminSession.member,
    permission_level: "manage",
  },
  {
    ...memberSession.member,
    permission_level: "manage",
  },
  {
    id: "member-3",
    family_space_id: "family-1",
    user_account_id: "user-3",
    name: "李爸爸",
    gender: "male",
    birth_date: "1956-08-20",
    height_cm: 172,
    blood_type: "B+",
    avatar_url: null,
    created_at: "2026-03-15T08:00:00Z",
    updated_at: "2026-03-15T08:00:00Z",
    permission_level: "manage",
  },
];

const defaultAdminSettings = {
  health_summary_refresh_time: "05:00",
  care_plan_refresh_time: "06:00",
  transcription: {
    provider: "openai",
    api_key: "stt-key",
    model: "gpt-4o-mini-transcribe",
    language: "zh",
    timeout: 30,
    local_whisper_model: "small",
    local_whisper_device: "auto",
    local_whisper_compute_type: "default",
    local_whisper_download_root: null,
  },
  chat_model: {
    base_url: "https://example.invalid/v1",
    api_key: "chat-key",
    model: "gpt-4.1-mini",
  },
};

type PermissionStore = {
  allScope: MemberPermissionGrant[];
  specific: Record<string, MemberPermissionGrant[]>;
};

function createPermissionStore(): PermissionStore {
  return {
    allScope: [],
    specific: {
      "member-1": [],
      "member-2": [],
      "member-3": [],
    },
  };
}

function snapshotPermissions(
  store: PermissionStore,
  memberId: string,
): MemberPermissionGrant[] {
  return [
    ...store.specific[memberId],
    ...store.allScope,
  ].map((grant) => ({ ...grant }));
}

function installPermissionMocks(store: PermissionStore) {
  let counter = 0;

  listMemberPermissionsMock.mockImplementation(
    async (_session: AuthSession, memberId: string) => snapshotPermissions(store, memberId),
  );

  grantMemberPermissionMock.mockImplementation(
    async (
      _session: AuthSession,
      memberId: string,
      payload: {
        user_account_id: string;
        permission_level: "read" | "write" | "manage";
        target_scope: "specific" | "all";
      },
    ) => {
      counter += 1;
      const subject = members.find(
        (member) => member.user_account_id === payload.user_account_id,
      );

      const grant: MemberPermissionGrant = {
        id: `grant-${counter}`,
        member_id: payload.target_scope === "specific" ? memberId : null,
        user_account_id: payload.user_account_id,
        permission_level: payload.permission_level,
        target_scope: payload.target_scope,
        created_at: `2026-03-15T08:0${counter}:00Z`,
        user_username: subject?.name ?? payload.user_account_id,
        user_email: `${payload.user_account_id}@example.com`,
        user_role: subject?.id === "member-1" ? "admin" : "member",
        user_member_id: subject?.id ?? null,
        user_member_name: subject?.name ?? null,
      };

      if (payload.target_scope === "all") {
        store.allScope = store.allScope.filter(
          (item) =>
            !(
              item.user_account_id === payload.user_account_id &&
              item.permission_level === payload.permission_level
            ),
        );
        store.allScope.push(grant);
      } else {
        const existing = store.specific[memberId] ?? [];
        store.specific[memberId] = existing.filter(
          (item) =>
            !(
              item.user_account_id === payload.user_account_id &&
              item.permission_level === payload.permission_level
            ),
        );
        store.specific[memberId].push(grant);
      }

      return { ...grant };
    },
  );

  revokeMemberPermissionMock.mockImplementation(
    async (_session: AuthSession, memberId: string, grantId: string) => {
      if (memberId in store.specific) {
        store.specific[memberId] = store.specific[memberId].filter(
          (grant) => grant.id !== grantId,
        );
      }
      store.allScope = store.allScope.filter((grant) => grant.id !== grantId);
    },
  );
}

function renderSheet(session: AuthSession = adminSession) {
  return render(
    <PreferencesProvider>
      <SettingsSheet
        members={members}
        onClose={() => {}}
        onMembersChange={() => {}}
        open
        session={session}
      />
    </PreferencesProvider>,
  );
}

describe("SettingsSheet", () => {
  beforeEach(() => {
    createMemberMock.mockReset();
    listMemberPermissionsMock.mockReset();
    grantMemberPermissionMock.mockReset();
    revokeMemberPermissionMock.mockReset();
    getAdminSettingsMock.mockReset();
    updateAdminSettingsMock.mockReset();
    getLocalWhisperModelStatusMock.mockReset();
    downloadLocalWhisperModelMock.mockReset();
    deleteFamilySpaceMock.mockReset();
    getAdminSettingsMock.mockResolvedValue(defaultAdminSettings);
    getLocalWhisperModelStatusMock.mockResolvedValue({
      present: true,
      resolved_path: "/tmp/mock-whisper",
      huggingface_repo_id: null,
      message: null,
    });
    updateAdminSettingsMock.mockImplementation(async (_session, payload) => ({
      ...defaultAdminSettings,
      ...payload,
      transcription: {
        ...defaultAdminSettings.transcription,
        ...(payload.transcription ?? {}),
      },
      chat_model: {
        ...defaultAdminSettings.chat_model,
        ...(payload.chat_model ?? {}),
      },
    }));
  });

  it("shows the redesigned tabs for admin and hides admin config for non-admin users", () => {
    const { rerender } = render(
      <PreferencesProvider>
        <SettingsSheet
          members={members}
          onClose={() => {}}
          onMembersChange={() => {}}
          open
          session={adminSession}
        />
      </PreferencesProvider>,
    );

    expect(screen.getByRole("button", { name: /偏好/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /成员管理/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /管理员配置/ })).toBeInTheDocument();

    rerender(
      <PreferencesProvider>
        <SettingsSheet
          members={members}
          onClose={() => {}}
          onMembersChange={() => {}}
          open
          session={memberSession}
        />
      </PreferencesProvider>,
    );

    expect(screen.getByRole("button", { name: /偏好/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /成员管理/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /管理员配置/ }),
    ).not.toBeInTheDocument();
  });

  it("expands member rows inline, supports multiple open rows, and collapses on second click", async () => {
    installPermissionMocks(createPermissionStore());
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "成员管理" }));
    fireEvent.click(
      screen.getByRole("button", { name: "展开 张妈妈 的权限设置" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "展开 李爸爸 的权限设置" }),
    );

    const expandedLabels = await screen.findAllByText("管理权限");
    expect(expandedLabels.length).toBe(2);

    fireEvent.click(
      screen.getByRole("button", { name: "收起 张妈妈 的权限设置" }),
    );

    expect(screen.getAllByText("管理权限").length).toBe(1);
  });

  it("saves permission clicks immediately, mirrors write targets into read, and locks selectors when manage is enabled", async () => {
    const store = createPermissionStore();
    installPermissionMocks(store);
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "成员管理" }));
    fireEvent.click(
      screen.getByRole("button", { name: "展开 张妈妈 的权限设置" }),
    );

    expect(await screen.findByText("管理权限")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "选择 张妈妈 的可写入对象" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "切换 可写入 对象 李爸爸" }),
    );

    await waitFor(() => {
      expect(grantMemberPermissionMock).toHaveBeenCalledWith(adminSession, "member-3", {
        user_account_id: "user-2",
        permission_level: "write",
        target_scope: "specific",
      });
    });

    const readSection = screen.getByLabelText("张妈妈 可读取");
    const writeSection = screen.getByLabelText("张妈妈 可写入");
    expect(within(readSection).getByText("李爸爸")).toBeInTheDocument();
    expect(within(writeSection).getAllByText("李爸爸").length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("switch", { name: "切换 张妈妈 的管理全部成员权限" }),
    );

    await waitFor(() => {
      expect(grantMemberPermissionMock).toHaveBeenCalledWith(adminSession, "member-2", {
        user_account_id: "user-2",
        permission_level: "manage",
        target_scope: "all",
      });
      expect(revokeMemberPermissionMock).toHaveBeenCalledWith(
        adminSession,
        "member-3",
        "grant-1",
      );
    });

    expect(
      screen.getByRole("button", { name: "选择 张妈妈 的可读取对象" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "选择 张妈妈 的可写入对象" }),
    ).toBeDisabled();
    expect(within(readSection).getByText("所有人")).toBeInTheDocument();
    expect(within(writeSection).getAllByText("所有人").length).toBeGreaterThan(0);
  });

  it("renders the redesigned preference page with language only", async () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "偏好" }));

    expect(await screen.findByRole("heading", { name: "语言" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "外观" })).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("每日健康状态更新时间"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("每日计划更新时间")).not.toBeInTheDocument();
    expect(getAdminSettingsMock).not.toHaveBeenCalled();
  });

  it("does not expose admin configuration to non-admin users", async () => {
    renderSheet(memberSession);

    fireEvent.click(screen.getByRole("button", { name: "偏好" }));

    expect(await screen.findByRole("heading", { name: "语言" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "管理员配置" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("每日健康状态更新时间")).not.toBeInTheDocument();
    expect(getAdminSettingsMock).not.toHaveBeenCalled();
  });

  it("loads and saves merged admin settings for admin users", async () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "管理员配置" }));

    const summaryTimeInput = await screen.findByLabelText("每日健康状态更新时间");
    const carePlanTimeInput = screen.getByLabelText("每日计划更新时间");
    expect(summaryTimeInput).toHaveValue("05:00");
    expect(carePlanTimeInput).toHaveValue("06:00");
    expect(screen.getByRole("heading", { name: "语音转录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "对话模型" })).toBeInTheDocument();

    const openaiSttRadio = screen.getByRole("radio", { name: /OpenAI API/ });
    const localSttRadio = screen.getByRole("radio", { name: /本地 Whisper/ });
    const chatBaseUrlInput = screen.getByLabelText("对话 Base URL");
    const chatApiKeyInput = screen.getByLabelText("对话 API Key");
    const chatModelInput = screen.getByLabelText("对话模型");

    expect(openaiSttRadio).toHaveAttribute("aria-checked", "true");
    expect(localSttRadio).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("转录模型")).toHaveValue("gpt-4o-mini-transcribe");
    expect(screen.getByLabelText("转录超时时间（秒）")).toHaveValue(30);
    expect(chatBaseUrlInput).toHaveValue("https://example.invalid/v1");
    expect(chatApiKeyInput).toHaveValue("chat-key");
    expect(chatModelInput).toHaveValue("gpt-4.1-mini");

    fireEvent.change(summaryTimeInput, { target: { value: "07:30" } });
    fireEvent.change(carePlanTimeInput, { target: { value: "08:45" } });

    await waitFor(
      () => {
        expect(updateAdminSettingsMock).toHaveBeenCalledWith(adminSession, {
          health_summary_refresh_time: "07:30",
          care_plan_refresh_time: "08:45",
        });
      },
      { timeout: 3000 },
    );

    fireEvent.click(localSttRadio);
    await waitFor(() => {
      expect(updateAdminSettingsMock).toHaveBeenCalledWith(adminSession, {
        transcription: { provider: "local_whisper" },
      });
    });

    const localWhisperModelInput = screen.getByLabelText("Local Whisper 模型");
    fireEvent.change(localWhisperModelInput, {
      target: { value: "whisper-small" },
    });
    const transcriptionTimeoutInput = screen.getByLabelText("转录超时时间（秒）");
    fireEvent.change(transcriptionTimeoutInput, { target: { value: "9.5" } });
    fireEvent.change(chatBaseUrlInput, {
      target: { value: "https://override.invalid/v1" },
    });
    fireEvent.change(chatApiKeyInput, { target: { value: "override-key" } });
    fireEvent.change(chatModelInput, { target: { value: "gpt-4.1-nano" } });

    await waitFor(
      () => {
        expect(updateAdminSettingsMock).toHaveBeenCalledWith(adminSession, {
          transcription: {
            provider: "local_whisper",
            model: "gpt-4o-mini-transcribe",
            language: "zh",
            timeout: 9.5,
            api_key: "stt-key",
            local_whisper_model: "whisper-small",
            local_whisper_device: "auto",
            local_whisper_compute_type: "default",
            local_whisper_download_root: null,
          },
          chat_model: {
            base_url: "https://override.invalid/v1",
            api_key: "override-key",
            model: "gpt-4.1-nano",
          },
        });
      },
      { timeout: 3000 },
    );

    expect(
      screen.queryByRole("button", { name: "保存时间设置" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "保存 AI 配置" }),
    ).not.toBeInTheDocument();
  });

  it("shows danger zone and deletes family space when confirmed", async () => {
    const onFamilySpaceDeleted = vi.fn();
    const onClose = vi.fn();
    deleteFamilySpaceMock.mockResolvedValue(undefined);

    render(
      <PreferencesProvider>
        <SettingsSheet
          members={members}
          onClose={onClose}
          onFamilySpaceDeleted={onFamilySpaceDeleted}
          onMembersChange={() => {}}
          open
          session={adminSession}
        />
      </PreferencesProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "管理员配置" }));

    expect(await screen.findByRole("heading", { name: "危险区域" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "注销家庭空间" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "确认注销" }));

    await waitFor(() => {
      expect(deleteFamilySpaceMock).toHaveBeenCalledWith(adminSession);
      expect(onFamilySpaceDeleted).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("downloads the missing local Whisper model and refreshes its status", async () => {
    let probeCount = 0;
    getLocalWhisperModelStatusMock.mockImplementation(async () => {
      probeCount += 1;
      if (probeCount === 1) {
        return {
          present: false,
          resolved_path: null,
          huggingface_repo_id: "Systran/faster-whisper-small",
          message: "Model not found locally.",
        };
      }
      return {
        present: true,
        resolved_path: "/tmp/hf-cache/models--Systran--faster-whisper-small/snapshots/123",
        huggingface_repo_id: "Systran/faster-whisper-small",
        message: null,
      };
    });
    downloadLocalWhisperModelMock.mockResolvedValue({
      present: true,
      resolved_path: "/tmp/hf-cache/models--Systran--faster-whisper-small/snapshots/123",
      huggingface_repo_id: "Systran/faster-whisper-small",
      message: null,
    });

    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "管理员配置" }));
    await screen.findByRole("heading", { name: "语音转录" });
    const localWhisperRadio = screen.getByRole("radio", { name: /本地 Whisper/ });
    await waitFor(() => {
      expect(localWhisperRadio).not.toBeDisabled();
    });
    fireEvent.click(localWhisperRadio);

    const downloadButton = await screen.findByRole("button", { name: "下载" });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(downloadLocalWhisperModelMock).toHaveBeenCalledWith(adminSession, {
        model: "small",
        downloadRoot: "",
      });
    });
    await waitFor(() => {
      expect(getLocalWhisperModelStatusMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("button", { name: "下载" })).not.toBeInTheDocument();
    expect(await screen.findByLabelText("已找到本地模型")).toBeInTheDocument();
  });
});
