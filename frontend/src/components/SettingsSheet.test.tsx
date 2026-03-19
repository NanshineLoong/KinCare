import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberPermissionGrant } from "../api/members";
import type { AuthMember, AuthSession } from "../auth/session";
import { SettingsSheet } from "./SettingsSheet";

const createMemberMock = vi.fn();
const listMemberPermissionsMock = vi.fn();
const grantMemberPermissionMock = vi.fn();
const revokeMemberPermissionMock = vi.fn();

vi.mock("../api/members", () => ({
  createMember: (...args: unknown[]) => createMemberMock(...args),
  listMemberPermissions: (...args: unknown[]) => listMemberPermissionsMock(...args),
  grantMemberPermission: (...args: unknown[]) => grantMemberPermissionMock(...args),
  revokeMemberPermission: (...args: unknown[]) => revokeMemberPermissionMock(...args),
}));

const adminSession: AuthSession = {
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

const memberSession: AuthSession = {
  ...adminSession,
  user: {
    ...adminSession.user,
    id: "user-2",
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
    <SettingsSheet
      members={members}
      onClose={() => {}}
      onMembersChange={() => {}}
      open
      session={session}
    />,
  );
}

describe("SettingsSheet", () => {
  beforeEach(() => {
    createMemberMock.mockReset();
    listMemberPermissionsMock.mockReset();
    grantMemberPermissionMock.mockReset();
    revokeMemberPermissionMock.mockReset();
  });

  it("shows all Step 7A tabs for admin and hides AI config for non-admin users", () => {
    const { rerender } = render(
      <SettingsSheet
        members={members}
        onClose={() => {}}
        onMembersChange={() => {}}
        open
        session={adminSession}
      />,
    );

    expect(screen.getByRole("button", { name: /成员管理/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /偏好/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI 配置/ })).toBeInTheDocument();

    rerender(
      <SettingsSheet
        members={members}
        onClose={() => {}}
        onMembersChange={() => {}}
        open
        session={memberSession}
      />,
    );

    expect(screen.getByRole("button", { name: /成员管理/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /偏好/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /AI 配置/ })).not.toBeInTheDocument();
  });

  it("expands member rows inline, supports multiple open rows, and collapses on second click", async () => {
    installPermissionMocks(createPermissionStore());
    renderSheet();

    fireEvent.click(
      screen.getByRole("button", { name: "展开 张妈妈 的权限设置" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "展开 李爸爸 的权限设置" }),
    );

    const expandedLabels = await screen.findAllByText("管理全部成员");
    expect(expandedLabels.length).toBe(2);

    fireEvent.click(
      screen.getByRole("button", { name: "收起 张妈妈 的权限设置" }),
    );

    expect(screen.getAllByText("管理全部成员").length).toBe(1);
  });

  it("saves permission clicks immediately, mirrors write targets into read, and locks selectors when manage is enabled", async () => {
    const store = createPermissionStore();
    installPermissionMocks(store);
    renderSheet();

    fireEvent.click(
      screen.getByRole("button", { name: "展开 张妈妈 的权限设置" }),
    );

    expect(await screen.findByText("管理全部成员")).toBeInTheDocument();

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
});
