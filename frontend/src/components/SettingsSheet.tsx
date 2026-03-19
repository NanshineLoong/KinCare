import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  getAdminSettings,
  updateAdminSettings,
  type AdminSettings,
} from "../api/adminSettings";
import {
  createMember,
  grantMemberPermission,
  listMemberPermissions,
  revokeMemberPermission,
  type GrantedPermissionLevel,
  type MemberPermissionGrant,
  type PermissionScope,
} from "../api/members";
import type { AuthMember, AuthSession } from "../auth/session";
import {
  usePreferences,
  type AppLanguage,
  type AppTheme,
} from "../preferences";

type SettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  members: AuthMember[];
  session: AuthSession;
  onMembersChange: (members: AuthMember[]) => void;
};

type SettingsTab = "members" | "preferences" | "ai";

type PermissionSelection = {
  manageAll: boolean;
  readAll: boolean;
  writeAll: boolean;
  readIds: string[];
  writeIds: string[];
};

type DesiredGrant = {
  member_id: string | null;
  permission_level: GrantedPermissionLevel;
  target_scope: PermissionScope;
};

type PermissionPickerProps = {
  allSelected: boolean;
  disabled: boolean;
  label: string;
  lockedIds?: string[];
  memberName: string;
  open: boolean;
  saving: boolean;
  selectedIds: string[];
  targetMembers: AuthMember[];
  onToggleAll: () => void;
  onToggleMember: (memberId: string) => void;
  onToggleOpen: () => void;
};

type TranscriptionProvider = AdminSettings["transcription"]["provider"];

const TAB_DEFINITIONS: Array<{
  key: SettingsTab;
  icon: string;
  adminOnly?: boolean;
}> = [
  { key: "members", icon: "manage_accounts" },
  { key: "preferences", icon: "tune" },
  { key: "ai", icon: "neurology", adminOnly: true },
];

function getAvatarColor(name: string): string {
  const palette = [
    "#E67E7E",
    "#4A6076",
    "#2D4F3E",
    "#7D746D",
    "#B8860B",
    "#6B8E23",
    "#CD5C5C",
    "#4682B4",
  ];
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values));
}

function permissionKey(grant: {
  member_id: string | null;
  permission_level: GrantedPermissionLevel;
  target_scope: PermissionScope;
}): string {
  return `${grant.permission_level}:${grant.target_scope}:${grant.member_id ?? "*"}`;
}

function buildSelection(grants: MemberPermissionGrant[]): PermissionSelection {
  const readIds = new Set<string>();
  const writeIds = new Set<string>();
  let manageAll = false;
  let readAll = false;
  let writeAll = false;

  for (const grant of grants) {
    if (grant.permission_level === "manage") {
      if (grant.target_scope === "all") {
        manageAll = true;
      } else if (grant.member_id) {
        writeIds.add(grant.member_id);
        readIds.add(grant.member_id);
      }
      continue;
    }

    if (grant.permission_level === "write") {
      if (grant.target_scope === "all") {
        writeAll = true;
      } else if (grant.member_id) {
        writeIds.add(grant.member_id);
        readIds.add(grant.member_id);
      }
      continue;
    }

    if (grant.target_scope === "all") {
      readAll = true;
    } else if (grant.member_id) {
      readIds.add(grant.member_id);
    }
  }

  if (manageAll) {
    return {
      manageAll: true,
      readAll: true,
      writeAll: true,
      readIds: [],
      writeIds: [],
    };
  }

  if (writeAll) {
    readAll = true;
  }

  return {
    manageAll: false,
    readAll,
    writeAll,
    readIds: uniqueIds([...readIds]),
    writeIds: uniqueIds([...writeIds]),
  };
}

function buildDesiredGrants(selection: PermissionSelection): DesiredGrant[] {
  if (selection.manageAll) {
    return [
      {
        member_id: null,
        permission_level: "manage",
        target_scope: "all",
      },
    ];
  }

  const grants: DesiredGrant[] = [];

  if (selection.writeAll) {
    grants.push({
      member_id: null,
      permission_level: "write",
      target_scope: "all",
    });
  } else {
    for (const memberId of uniqueIds(selection.writeIds)) {
      grants.push({
        member_id: memberId,
        permission_level: "write",
        target_scope: "specific",
      });
    }
  }

  if (selection.readAll && !selection.writeAll) {
    grants.push({
      member_id: null,
      permission_level: "read",
      target_scope: "all",
    });
  } else if (!selection.readAll) {
    for (const memberId of uniqueIds(selection.readIds)) {
      if (selection.writeIds.includes(memberId)) {
        continue;
      }
      grants.push({
        member_id: memberId,
        permission_level: "read",
        target_scope: "specific",
      });
    }
  }

  return grants;
}

async function loadSubjectGrants(
  session: AuthSession,
  members: AuthMember[],
  userAccountId: string,
): Promise<MemberPermissionGrant[]> {
  const targetPermissions = await Promise.all(
    members.map((member) => listMemberPermissions(session, member.id)),
  );

  const deduped = new Map<string, MemberPermissionGrant>();
  for (const grants of targetPermissions) {
    for (const grant of grants) {
      if (grant.user_account_id === userAccountId) {
        deduped.set(grant.id, grant);
      }
    }
  }
  return Array.from(deduped.values());
}

async function syncSubjectGrants(
  session: AuthSession,
  subjectMember: AuthMember,
  currentGrants: MemberPermissionGrant[],
  desiredGrants: DesiredGrant[],
): Promise<void> {
  const desiredKeys = new Set(desiredGrants.map((grant) => permissionKey(grant)));
  const existingByKey = new Map<string, MemberPermissionGrant[]>();

  for (const grant of currentGrants) {
    const key = permissionKey(grant);
    const current = existingByKey.get(key) ?? [];
    current.push(grant);
    existingByKey.set(key, current);
  }

  const keptKeys = new Set<string>();
  const grantsToDelete: MemberPermissionGrant[] = [];

  for (const [key, grants] of existingByKey.entries()) {
    if (!desiredKeys.has(key)) {
      grantsToDelete.push(...grants);
      continue;
    }

    keptKeys.add(key);
    if (grants.length > 1) {
      grantsToDelete.push(...grants.slice(1));
    }
  }

  for (const grant of grantsToDelete) {
    await revokeMemberPermission(
      session,
      grant.member_id ?? subjectMember.id,
      grant.id,
    );
  }

  for (const desiredGrant of desiredGrants) {
    const key = permissionKey(desiredGrant);
    if (keptKeys.has(key)) {
      continue;
    }

    await grantMemberPermission(
      session,
      desiredGrant.member_id ?? subjectMember.id,
      {
        user_account_id: subjectMember.user_account_id ?? "",
        permission_level: desiredGrant.permission_level,
        target_scope: desiredGrant.target_scope,
      },
    );
  }
}

function AvatarPill({ member }: { member: AuthMember }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#E7DFD4] bg-white px-2.5 py-1.5 text-sm text-[#2D2926]">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: getAvatarColor(member.name) }}
      >
        {member.name.charAt(0).toUpperCase()}
      </span>
      <span>{member.name}</span>
    </div>
  );
}

function AvatarPreview({
  allSelected,
  selectedIds,
  targetMembers,
}: {
  allSelected: boolean;
  selectedIds: string[];
  targetMembers: AuthMember[];
}) {
  if (allSelected) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#D9D4CD] bg-[#F4EFE8] px-3 py-1.5 text-sm font-medium text-[#2D2926]">
        <span className="material-symbols-outlined text-[18px] text-[#7D746D]">
          groups
        </span>
        所有人
      </div>
    );
  }

  const selectedMembers = targetMembers.filter((member) =>
    selectedIds.includes(member.id),
  );

  if (selectedMembers.length === 0) {
    return <span className="text-sm text-[#9C9288]">未设置</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedMembers.map((member) => (
        <AvatarPill key={member.id} member={member} />
      ))}
    </div>
  );
}

function PermissionPicker({
  allSelected,
  disabled,
  label,
  lockedIds = [],
  memberName,
  open,
  saving,
  selectedIds,
  targetMembers,
  onToggleAll,
  onToggleMember,
  onToggleOpen,
}: PermissionPickerProps) {
  const lockedIdSet = new Set(lockedIds);

  return (
    <div aria-label={`${memberName} ${label}`} className="space-y-2">
      <p className="text-sm font-medium text-[#2D2926]">{label}</p>
      <button
        aria-expanded={open}
        aria-label={`选择 ${memberName} 的${label}对象`}
        className="flex w-full items-center justify-between rounded-[1.5rem] border border-[#E7DFD4] bg-white px-4 py-3 text-left transition hover:border-[#D9D4CD] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onToggleOpen}
        type="button"
      >
        <AvatarPreview
          allSelected={allSelected}
          selectedIds={selectedIds}
          targetMembers={targetMembers}
        />
        <span className="material-symbols-outlined text-[18px] text-[#7D746D]">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="rounded-[1.5rem] border border-[#E7DFD4] bg-white p-3 shadow-sm">
          <div className="space-y-2">
            <button
              aria-label={`切换 ${label} 对象 所有人`}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition ${
                allSelected
                  ? "bg-[#F4EFE8] text-[#2D2926]"
                  : "hover:bg-[#F8F3EE] text-[#2D2926]"
              }`}
              disabled={disabled || saving}
              onClick={onToggleAll}
              type="button"
            >
              <span className="inline-flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4EFE8] text-[#7D746D]">
                  <span className="material-symbols-outlined text-[18px]">groups</span>
                </span>
                <span className="font-medium">所有人</span>
              </span>
              {allSelected && (
                <span className="material-symbols-outlined text-[18px] text-[#4A6076]">
                  check
                </span>
              )}
            </button>

            <div className="border-t border-[#F2EDE7]" />

            {targetMembers.map((member) => {
              const isLocked = lockedIdSet.has(member.id);
              const isSelected = allSelected || selectedIds.includes(member.id);
              return (
                <button
                  aria-label={`切换 ${label} 对象 ${member.name}`}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition ${
                    isSelected
                      ? "bg-[#FBF8F5] text-[#2D2926]"
                      : "hover:bg-[#F8F3EE] text-[#2D2926]"
                  }`}
                  disabled={disabled || saving || isLocked || allSelected}
                  key={member.id}
                  onClick={() => onToggleMember(member.id)}
                  type="button"
                >
                  <span className="inline-flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: getAvatarColor(member.name) }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <span className="block font-medium">{member.name}</span>
                      {isLocked && (
                        <span className="text-xs text-[#9C9288]">已由写权限继承</span>
                      )}
                    </span>
                  </span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[18px] text-[#4A6076]">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PreferenceChoiceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-[#2D2926] bg-[#2D2926] text-white"
          : "border-[#E7DFD4] bg-white text-[#2D2926] hover:border-[#D9D4CD] hover:bg-[#FBF8F5]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function MemberPermissionRow({
  expanded,
  member,
  members,
  session,
  onToggleExpand,
}: {
  expanded: boolean;
  member: AuthMember;
  members: AuthMember[];
  session: AuthSession;
  onToggleExpand: () => void;
}) {
  const [grants, setGrants] = useState<MemberPermissionGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<"read" | "write" | null>(null);
  const readPickerRef = useRef<HTMLDivElement | null>(null);
  const writePickerRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = session.user.role === "admin";
  const canEdit = isAdmin && Boolean(member.user_account_id);
  const targetMembers = members.filter((candidate) => candidate.id !== member.id);
  const selection = buildSelection(grants);

  useEffect(() => {
    if (!expanded) {
      setOpenPicker(null);
      return;
    }

    if (!member.user_account_id) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextGrants = await loadSubjectGrants(
          session,
          members,
          member.user_account_id ?? "",
        );
        if (!cancelled) {
          setGrants(nextGrants);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "权限加载失败，请稍后重试。",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [expanded, member.user_account_id, members, session]);

  useEffect(() => {
    if (!openPicker) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        readPickerRef.current?.contains(target) ||
        writePickerRef.current?.contains(target)
      ) {
        return;
      }
      setOpenPicker(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openPicker]);

  async function applySelection(nextSelection: PermissionSelection) {
    if (!member.user_account_id) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await syncSubjectGrants(
        session,
        member,
        grants,
        buildDesiredGrants(nextSelection),
      );
      const nextGrants = await loadSubjectGrants(
        session,
        members,
        member.user_account_id,
      );
      setGrants(nextGrants);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "权限保存失败，请稍后重试。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleManageToggle() {
    if (!canEdit) {
      return;
    }

    if (selection.manageAll) {
      await applySelection({
        manageAll: false,
        readAll: false,
        writeAll: false,
        readIds: [],
        writeIds: [],
      });
      return;
    }

    await applySelection({
      manageAll: true,
      readAll: true,
      writeAll: true,
      readIds: [],
      writeIds: [],
    });
  }

  async function handleToggleReadAll() {
    if (!canEdit || selection.manageAll) {
      return;
    }

    if (selection.readAll) {
      await applySelection({
        ...selection,
        readAll: false,
        readIds: uniqueIds(selection.writeIds),
      });
      return;
    }

    await applySelection({
      ...selection,
      readAll: true,
      readIds: [],
    });
  }

  async function handleToggleReadMember(memberId: string) {
    if (!canEdit || selection.manageAll || selection.readAll) {
      return;
    }
    if (selection.writeIds.includes(memberId)) {
      return;
    }

    const readIds = selection.readIds.includes(memberId)
      ? selection.readIds.filter((id) => id !== memberId)
      : [...selection.readIds, memberId];

    await applySelection({
      ...selection,
      readIds,
    });
  }

  async function handleToggleWriteAll() {
    if (!canEdit || selection.manageAll) {
      return;
    }

    if (selection.writeAll) {
      await applySelection({
        ...selection,
        writeAll: false,
        readAll: false,
        readIds: [],
        writeIds: [],
      });
      return;
    }

    await applySelection({
      ...selection,
      writeAll: true,
      readAll: true,
      readIds: [],
      writeIds: [],
    });
  }

  async function handleToggleWriteMember(memberId: string) {
    if (!canEdit || selection.manageAll || selection.writeAll) {
      return;
    }

    const nextWriteIds = selection.writeIds.includes(memberId)
      ? selection.writeIds.filter((id) => id !== memberId)
      : [...selection.writeIds, memberId];
    const nextReadIds = selection.writeIds.includes(memberId)
      ? selection.readIds
      : uniqueIds([...selection.readIds, memberId]);

    await applySelection({
      ...selection,
      writeIds: nextWriteIds,
      readIds: nextReadIds,
    });
  }

  return (
    <div className="rounded-[2rem] border border-[#F2EDE7] bg-white shadow-sm">
      <div
        className={`flex items-center justify-between gap-4 px-5 py-4 transition ${
          expanded ? "border-b border-[#F2EDE7] bg-[#FBF8F5]" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
            style={{ backgroundColor: getAvatarColor(member.name) }}
          >
            {member.name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[#2D2926]">
                {member.name}
              </h3>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  member.user_account_id
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-[#E7DFD4] bg-[#F8F3EE] text-[#9C9288]"
                }`}
              >
                {member.user_account_id ? "已绑定" : "未绑定"}
              </span>
            </div>
          </div>
        </div>

        <button
          aria-label={
            expanded
              ? `收起 ${member.name} 的权限设置`
              : `展开 ${member.name} 的权限设置`
          }
          className="flex items-center justify-center rounded-full p-2 text-[#7D746D] transition hover:bg-[#F5F0EA] hover:text-[#2D2926] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canEdit}
          onClick={onToggleExpand}
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 px-5 py-5">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {!member.user_account_id && (
            <div className="rounded-[1.5rem] border border-[#E7DFD4] bg-[#FBF8F5] px-4 py-4 text-sm text-[#7D746D]">
              未绑定账号，无法配置权限
            </div>
          )}

          {member.user_account_id && loading && (
            <div className="rounded-[1.5rem] border border-[#E7DFD4] bg-[#FBF8F5] px-4 py-5 text-sm text-[#7D746D]">
              权限加载中...
            </div>
          )}

          {member.user_account_id && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-[1.5rem] border border-[#E7DFD4] bg-[#FBF8F5] px-4 py-3">
                <span className="text-sm font-medium text-[#2D2926]">管理全部成员</span>
                <button
                  aria-label={`切换 ${member.name} 的管理全部成员权限`}
                  aria-pressed={selection.manageAll}
                  className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    selection.manageAll ? "bg-[#2D2926]" : "bg-[#D9D4CD]"
                  }`}
                  disabled={!canEdit || saving}
                  onClick={() => void handleManageToggle()}
                  role="switch"
                  type="button"
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                      selection.manageAll ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div ref={readPickerRef}>
                  <PermissionPicker
                    allSelected={selection.readAll}
                    disabled={!canEdit || selection.manageAll}
                    label="可读取"
                    lockedIds={selection.writeIds}
                    memberName={member.name}
                    open={openPicker === "read"}
                    saving={saving}
                    selectedIds={
                      selection.readAll
                        ? []
                        : uniqueIds([...selection.readIds, ...selection.writeIds])
                    }
                    targetMembers={targetMembers}
                    onToggleAll={() => void handleToggleReadAll()}
                    onToggleMember={(memberId) => void handleToggleReadMember(memberId)}
                    onToggleOpen={() =>
                      setOpenPicker((current) => (current === "read" ? null : "read"))
                    }
                  />
                </div>

                <div ref={writePickerRef}>
                  <PermissionPicker
                    allSelected={selection.writeAll}
                    disabled={!canEdit || selection.manageAll}
                    label="可写入"
                    memberName={member.name}
                    open={openPicker === "write"}
                    saving={saving}
                    selectedIds={selection.writeAll ? [] : selection.writeIds}
                    targetMembers={targetMembers}
                    onToggleAll={() => void handleToggleWriteAll()}
                    onToggleMember={(memberId) => void handleToggleWriteMember(memberId)}
                    onToggleOpen={() =>
                      setOpenPicker((current) => (current === "write" ? null : "write"))
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsSheet({
  open,
  onClose,
  members,
  session,
  onMembersChange,
}: SettingsSheetProps) {
  const { language, setLanguage, theme, setTheme, t } = usePreferences();
  const [activeTab, setActiveTab] = useState<SettingsTab>("members");
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [healthSummaryRefreshTime, setHealthSummaryRefreshTime] = useState("05:00");
  const [carePlanRefreshTime, setCarePlanRefreshTime] = useState("06:00");
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isLoadingAdminSettings, setIsLoadingAdminSettings] = useState(false);
  const [isSavingAdminSettings, setIsSavingAdminSettings] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
  const [sttProvider, setSttProvider] = useState<TranscriptionProvider>("openai");
  const [sttApiKey, setSttApiKey] = useState("");
  const [sttModel, setSttModel] = useState("gpt-4o-mini-transcribe");
  const [sttLanguage, setSttLanguage] = useState("zh");
  const [sttTimeout, setSttTimeout] = useState("30");
  const [localWhisperModel, setLocalWhisperModel] = useState("whisper-large-v3-turbo");
  const [localWhisperDevice, setLocalWhisperDevice] = useState("auto");
  const [localWhisperComputeType, setLocalWhisperComputeType] = useState("default");
  const [localWhisperDownloadRoot, setLocalWhisperDownloadRoot] = useState("");
  const [chatBaseUrl, setChatBaseUrl] = useState("");
  const [chatApiKey, setChatApiKey] = useState("");
  const [chatModel, setChatModel] = useState("gpt-4.1-mini");

  const isAdmin = session.user.role === "admin";
  const visibleTabs = TAB_DEFINITIONS.filter((tab) => !tab.adminOnly || isAdmin);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }

    document.body.style.overflow = "";
    setActiveTab("members");
    setExpandedMemberIds([]);
    setShowAddForm(false);
    setAddName("");
    setAddError(null);
    setSettingsNotice(null);
    setSettingsError(null);
    setAiNotice(null);
    setAiError(null);

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function applyAdminSettings(nextSettings: AdminSettings) {
    setHealthSummaryRefreshTime(nextSettings.health_summary_refresh_time);
    setCarePlanRefreshTime(nextSettings.care_plan_refresh_time);
    setSttProvider(nextSettings.transcription.provider);
    setSttApiKey(nextSettings.transcription.api_key ?? "");
    setSttModel(nextSettings.transcription.model);
    setSttLanguage(nextSettings.transcription.language ?? "");
    setSttTimeout(String(nextSettings.transcription.timeout));
    setLocalWhisperModel(nextSettings.transcription.local_whisper_model);
    setLocalWhisperDevice(nextSettings.transcription.local_whisper_device);
    setLocalWhisperComputeType(nextSettings.transcription.local_whisper_compute_type);
    setLocalWhisperDownloadRoot(
      nextSettings.transcription.local_whisper_download_root ?? "",
    );
    setChatBaseUrl(nextSettings.chat_model.base_url ?? "");
    setChatApiKey(nextSettings.chat_model.api_key ?? "");
    setChatModel(nextSettings.chat_model.model);
  }

  useEffect(() => {
    if (!open || !isAdmin || (activeTab !== "preferences" && activeTab !== "ai")) {
      return;
    }

    let cancelled = false;

    async function loadAdminSettings() {
      setIsLoadingAdminSettings(true);
      if (activeTab === "preferences") {
        setSettingsError(null);
      } else {
        setAiError(null);
      }
      try {
        const nextSettings = await getAdminSettings(session);
        if (cancelled) {
          return;
        }
        applyAdminSettings(nextSettings);
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : activeTab === "preferences"
                ? t("settingsTimeLoadError")
                : t("settingsAiLoadError");
          if (activeTab === "preferences") {
            setSettingsError(message);
          } else {
            setAiError(message);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAdminSettings(false);
        }
      }
    }

    void loadAdminSettings();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isAdmin, open, session, t]);

  async function handleSaveRefreshTimes() {
    setIsSavingAdminSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const nextSettings = await updateAdminSettings(session, {
        health_summary_refresh_time: healthSummaryRefreshTime,
        care_plan_refresh_time: carePlanRefreshTime,
      });
      setHealthSummaryRefreshTime(nextSettings.health_summary_refresh_time);
      setCarePlanRefreshTime(nextSettings.care_plan_refresh_time);
      setSettingsNotice(t("settingsTimeSaved"));
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : t("settingsTimeSaveError"),
      );
    } finally {
      setIsSavingAdminSettings(false);
    }
  }

  async function handleSaveAiSettings() {
    setIsSavingAiSettings(true);
    setAiError(null);
    setAiNotice(null);
    try {
      const nextSettings = await updateAdminSettings(session, {
        transcription: {
          provider: sttProvider,
          api_key: sttApiKey || null,
          model: sttModel || null,
          language: sttLanguage || null,
          timeout: Number(sttTimeout),
          local_whisper_model: localWhisperModel || null,
          local_whisper_device: localWhisperDevice || null,
          local_whisper_compute_type: localWhisperComputeType || null,
          local_whisper_download_root: localWhisperDownloadRoot || null,
        },
        chat_model: {
          base_url: chatBaseUrl || null,
          api_key: chatApiKey || null,
          model: chatModel || null,
        },
      });
      applyAdminSettings(nextSettings);
      setAiNotice(t("settingsAiSaved"));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : t("settingsAiSaveError"));
    } finally {
      setIsSavingAiSettings(false);
    }
  }

  const tabLabels: Record<SettingsTab, string> = {
    members: t("settingsTabMembers"),
    preferences: t("settingsTabPreferences"),
    ai: t("settingsTabAi"),
  };
  const languageOptions: Array<{ value: AppLanguage; label: string }> = [
    { value: "zh", label: t("settingsLanguageChinese") },
    { value: "en", label: t("settingsLanguageEnglish") },
  ];
  const themeOptions: Array<{ value: AppTheme; label: string }> = [
    { value: "light", label: t("settingsThemeLight") },
    { value: "dark", label: t("settingsThemeDark") },
    { value: "system", label: t("settingsThemeSystem") },
  ];

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    const name = addName.trim();
    if (!name) {
      return;
    }

    setAddLoading(true);
    setAddError(null);
    try {
      const newMember = await createMember(session, { name });
      onMembersChange([...members, newMember]);
      setShowAddForm(false);
      setAddName("");
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "添加失败");
    } finally {
      setAddLoading(false);
    }
  }

  function handleBackdropClick() {
    onClose();
  }

  function toggleExpandedMember(memberId: string) {
    setExpandedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label={t("settingsTitle")}
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12"
      role="dialog"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(45,41,38,0.15)] backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      <div
        className="relative flex h-[85vh] w-[88vw] max-w-6xl flex-col overflow-hidden rounded-[2.5rem] border border-white/50 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#F2EDE7] px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5F0EA]">
              <span className="material-symbols-outlined text-[22px] text-[#7D746D]">
                settings
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#2D2926]">{t("settingsTitle")}</h2>
          </div>
          <button
            aria-label={t("settingsTitle")}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#7D746D] transition hover:bg-[#F5F0EA] hover:text-[#2D2926]"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <nav className="flex shrink-0 gap-1 border-b border-[#F2EDE7] px-8 pt-1">
          {visibleTabs.map((tab) => (
            <button
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "border-[#2D2926] text-[#2D2926]"
                  : "border-transparent text-[#7D746D] hover:text-[#2D2926]"
              }`}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tabLabels[tab.key]}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6 no-scrollbar">
          {activeTab === "members" && (
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-[#F2EDE7] bg-[#FBF8F5] px-5 py-4">
                <h3 className="text-base font-semibold text-[#2D2926]">成员权限</h3>
                {isAdmin && !showAddForm && (
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[#2D2926] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1F1C19]"
                    onClick={() => setShowAddForm(true)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      person_add
                    </span>
                    添加成员
                  </button>
                )}
              </div>

              {showAddForm && (
                <form
                  className="rounded-[2rem] border border-[#E7DFD4] bg-white p-4"
                  onSubmit={handleAddMember}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      autoFocus
                      className="min-w-[180px] flex-1 rounded-full border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-2.5 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                      disabled={addLoading}
                      onChange={(event) => setAddName(event.target.value)}
                      placeholder="成员姓名"
                      type="text"
                      value={addName}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-full px-4 py-2 text-sm text-[#7D746D] transition hover:bg-[#F5F0EA]"
                        disabled={addLoading}
                        onClick={() => {
                          setShowAddForm(false);
                          setAddName("");
                          setAddError(null);
                        }}
                        type="button"
                      >
                        取消
                      </button>
                      <button
                        className="rounded-full bg-[#2D2926] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1F1C19] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!addName.trim() || addLoading}
                        type="submit"
                      >
                        {addLoading ? "添加中..." : "确认添加"}
                      </button>
                    </div>
                  </div>
                  {addError && (
                    <p className="mt-2 text-sm text-red-600" role="alert">
                      {addError}
                    </p>
                  )}
                </form>
              )}

              {members.map((member) => (
                <MemberPermissionRow
                  expanded={expandedMemberIds.includes(member.id)}
                  key={member.id}
                  member={member}
                  members={members}
                  onToggleExpand={() => toggleExpandedMember(member.id)}
                  session={session}
                />
              ))}
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="mx-auto max-w-5xl space-y-6">
              <div className="rounded-[2rem] border border-[#F2EDE7] bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#7D746D]">
                  {t("settingsPreferencesEyebrow")}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[#2D2926]">
                  {t("settingsPreferencesTitle")}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7D746D]">
                  {t("settingsPreferencesDescription")}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <section className="rounded-[2rem] border border-[#F2EDE7] bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-[#2D2926]">
                    {t("settingsSectionLanguage")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#7D746D]">
                    {t("settingsSectionLanguageDescription")}
                  </p>
                  <div className="mt-5 grid gap-3">
                    {languageOptions.map((option) => (
                      <PreferenceChoiceButton
                        active={language === option.value}
                        key={option.value}
                        label={option.label}
                        onClick={() => {
                          setLanguage(option.value);
                          setSettingsNotice(null);
                        }}
                      />
                    ))}
                  </div>
                </section>

                <section className="rounded-[2rem] border border-[#F2EDE7] bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-[#2D2926]">
                    {t("settingsSectionTime")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#7D746D]">
                    {t("settingsSectionTimeDescription")}
                  </p>

                  {settingsError && (
                    <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {settingsError}
                    </p>
                  )}
                  {settingsNotice && (
                    <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {settingsNotice}
                    </p>
                  )}

                  {isAdmin ? (
                    <div className="mt-5 space-y-4">
                      <label className="block text-sm font-medium text-[#2D2926]">
                        {t("settingsTimeHealthSummary")}
                        <input
                          aria-label={t("settingsTimeHealthSummary")}
                          className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                          disabled={isLoadingAdminSettings || isSavingAdminSettings}
                          onChange={(event) =>
                            setHealthSummaryRefreshTime(event.target.value)
                          }
                          type="time"
                          value={healthSummaryRefreshTime}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#2D2926]">
                        {t("settingsTimeCarePlan")}
                        <input
                          aria-label={t("settingsTimeCarePlan")}
                          className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                          disabled={isLoadingAdminSettings || isSavingAdminSettings}
                          onChange={(event) =>
                            setCarePlanRefreshTime(event.target.value)
                          }
                          type="time"
                          value={carePlanRefreshTime}
                        />
                      </label>
                      <button
                        className="w-full rounded-2xl bg-[#2D2926] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1F1C19] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLoadingAdminSettings || isSavingAdminSettings}
                        onClick={() => void handleSaveRefreshTimes()}
                        type="button"
                      >
                        {isSavingAdminSettings
                          ? t("settingsTimeSaving")
                          : t("settingsTimeSave")}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-5 rounded-2xl border border-[#E7DFD4] bg-[#FBF8F5] px-4 py-4 text-sm text-[#7D746D]">
                      {t("settingsTimeAdminOnly")}
                    </p>
                  )}
                </section>

                <section className="rounded-[2rem] border border-[#F2EDE7] bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-[#2D2926]">
                    {t("settingsSectionAppearance")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#7D746D]">
                    {t("settingsSectionAppearanceDescription")}
                  </p>
                  <div className="mt-5 grid gap-3">
                    {themeOptions.map((option) => (
                      <PreferenceChoiceButton
                        active={theme === option.value}
                        key={option.value}
                        label={option.label}
                        onClick={() => setTheme(option.value)}
                      />
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === "ai" && isAdmin && (
            <div className="mx-auto max-w-5xl space-y-6">
              <div className="rounded-[2rem] border border-[#F2EDE7] bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#7D746D]">
                  {t("settingsAiEyebrow")}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[#2D2926]">
                  {t("settingsAiTitle")}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7D746D]">
                  {t("settingsAiDescription")}
                </p>
              </div>

              {aiError && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {aiError}
                </p>
              )}
              {aiNotice && (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {aiNotice}
                </p>
              )}

              <div className="grid gap-5 xl:grid-cols-2">
                <section className="rounded-[2rem] border border-[#F2EDE7] bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-[#2D2926]">
                    {t("settingsAiSectionTranscription")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#7D746D]">
                    {t("settingsAiSectionTranscriptionDescription")}
                  </p>
                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-medium text-[#2D2926]">
                      {t("settingsAiTranscriptionProvider")}
                      <select
                        aria-label={t("settingsAiTranscriptionProvider")}
                        className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                        disabled={isLoadingAdminSettings || isSavingAiSettings}
                        onChange={(event) =>
                          setSttProvider(event.target.value as TranscriptionProvider)
                        }
                        value={sttProvider}
                      >
                        <option value="openai">openai</option>
                        <option value="local_whisper">local_whisper</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-[#2D2926]">
                      {t("settingsAiTranscriptionApiKey")}
                      <input
                        aria-label={t("settingsAiTranscriptionApiKey")}
                        className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                        disabled={isLoadingAdminSettings || isSavingAiSettings}
                        onChange={(event) => setSttApiKey(event.target.value)}
                        type="password"
                        value={sttApiKey}
                      />
                    </label>
                    <label className="block text-sm font-medium text-[#2D2926]">
                      {t("settingsAiTranscriptionModel")}
                      <input
                        aria-label={t("settingsAiTranscriptionModel")}
                        className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                        disabled={isLoadingAdminSettings || isSavingAiSettings}
                        onChange={(event) => setSttModel(event.target.value)}
                        type="text"
                        value={sttModel}
                      />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm font-medium text-[#2D2926]">
                        {t("settingsAiTranscriptionLanguage")}
                        <input
                          aria-label={t("settingsAiTranscriptionLanguage")}
                          className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                          disabled={isLoadingAdminSettings || isSavingAiSettings}
                          onChange={(event) => setSttLanguage(event.target.value)}
                          type="text"
                          value={sttLanguage}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#2D2926]">
                        {t("settingsAiTranscriptionTimeout")}
                        <input
                          aria-label={t("settingsAiTranscriptionTimeout")}
                          className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                          disabled={isLoadingAdminSettings || isSavingAiSettings}
                          min="0.1"
                          onChange={(event) => setSttTimeout(event.target.value)}
                          step="0.1"
                          type="number"
                          value={sttTimeout}
                        />
                      </label>
                    </div>

                    {sttProvider === "local_whisper" && (
                      <div className="space-y-4 rounded-[1.5rem] border border-[#E7DFD4] bg-[#FBF8F5] p-4">
                        <label className="block text-sm font-medium text-[#2D2926]">
                          {t("settingsAiLocalWhisperModel")}
                          <input
                            aria-label={t("settingsAiLocalWhisperModel")}
                            className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-white px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                            disabled={isLoadingAdminSettings || isSavingAiSettings}
                            onChange={(event) => setLocalWhisperModel(event.target.value)}
                            type="text"
                            value={localWhisperModel}
                          />
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block text-sm font-medium text-[#2D2926]">
                            {t("settingsAiLocalWhisperDevice")}
                            <input
                              aria-label={t("settingsAiLocalWhisperDevice")}
                              className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-white px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                              disabled={isLoadingAdminSettings || isSavingAiSettings}
                              onChange={(event) => setLocalWhisperDevice(event.target.value)}
                              type="text"
                              value={localWhisperDevice}
                            />
                          </label>
                          <label className="block text-sm font-medium text-[#2D2926]">
                            {t("settingsAiLocalWhisperComputeType")}
                            <input
                              aria-label={t("settingsAiLocalWhisperComputeType")}
                              className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-white px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                              disabled={isLoadingAdminSettings || isSavingAiSettings}
                              onChange={(event) =>
                                setLocalWhisperComputeType(event.target.value)
                              }
                              type="text"
                              value={localWhisperComputeType}
                            />
                          </label>
                        </div>
                        <label className="block text-sm font-medium text-[#2D2926]">
                          {t("settingsAiLocalWhisperDownloadRoot")}
                          <input
                            aria-label={t("settingsAiLocalWhisperDownloadRoot")}
                            className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-white px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                            disabled={isLoadingAdminSettings || isSavingAiSettings}
                            onChange={(event) =>
                              setLocalWhisperDownloadRoot(event.target.value)
                            }
                            placeholder="/models/whisper"
                            type="text"
                            value={localWhisperDownloadRoot}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[2rem] border border-[#F2EDE7] bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-[#2D2926]">
                    {t("settingsAiSectionChatModel")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#7D746D]">
                    {t("settingsAiSectionChatModelDescription")}
                  </p>
                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-medium text-[#2D2926]">
                      {t("settingsAiChatBaseUrl")}
                      <input
                        aria-label={t("settingsAiChatBaseUrl")}
                        className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                        disabled={isLoadingAdminSettings || isSavingAiSettings}
                        onChange={(event) => setChatBaseUrl(event.target.value)}
                        type="text"
                        value={chatBaseUrl}
                      />
                    </label>
                    <label className="block text-sm font-medium text-[#2D2926]">
                      {t("settingsAiChatApiKey")}
                      <input
                        aria-label={t("settingsAiChatApiKey")}
                        className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                        disabled={isLoadingAdminSettings || isSavingAiSettings}
                        onChange={(event) => setChatApiKey(event.target.value)}
                        type="password"
                        value={chatApiKey}
                      />
                    </label>
                    <label className="block text-sm font-medium text-[#2D2926]">
                      {t("settingsAiChatModel")}
                      <input
                        aria-label={t("settingsAiChatModel")}
                        className="mt-2 w-full rounded-2xl border border-[#D9D4CD] bg-[#FBF8F5] px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] focus:ring-1 focus:ring-[#4A6076]"
                        disabled={isLoadingAdminSettings || isSavingAiSettings}
                        onChange={(event) => setChatModel(event.target.value)}
                        type="text"
                        value={chatModel}
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div className="flex justify-end">
                <button
                  className="rounded-2xl bg-[#2D2926] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1F1C19] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoadingAdminSettings || isSavingAiSettings}
                  onClick={() => void handleSaveAiSettings()}
                  type="button"
                >
                  {isSavingAiSettings ? t("settingsAiSaving") : t("settingsAiSave")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
