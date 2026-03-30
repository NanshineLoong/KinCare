import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  downloadLocalWhisperModel,
  getAdminSettings,
  getLocalWhisperModelStatus,
  updateAdminSettings,
  type AdminSettings,
  type LocalWhisperModelStatus,
} from "../api/adminSettings";
import { updateUserPreferences } from "../api/auth";
import { deleteFamilySpace } from "../api/familySpace";
import {
  createMember,
  deleteMember,
  grantMemberPermission,
  listMemberPermissions,
  revokeMemberPermission,
  type GrantedPermissionLevel,
  type MemberPermissionGrant,
  type PermissionScope,
} from "../api/members";
import { writeSession, type AuthMember, type AuthSession } from "../auth/session";
import {
  usePreferences,
  type AppLanguage,
} from "../preferences";

type SettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  members: AuthMember[];
  session: AuthSession;
  onMembersChange: (members: AuthMember[]) => void;
  /** Called after the family space is deleted on the server (session should be cleared by the host). */
  onFamilySpaceDeleted?: () => void;
};

type SettingsTab = "members" | "preferences" | "admin";

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

const CUSTOM_LOCAL_WHISPER_MODEL_VALUE = "__custom__";

const TAB_DEFINITIONS: Array<{
  key: SettingsTab;
  icon: string;
  adminOnly?: boolean;
}> = [
  { key: "preferences", icon: "tune" },
  { key: "members", icon: "group" },
  { key: "admin", icon: "admin_panel_settings", adminOnly: true },
];

const LOCAL_WHISPER_MODEL_OPTIONS = [
  { value: "tiny.en", label: "tiny.en" },
  { value: "tiny", label: "tiny" },
  { value: "base.en", label: "base.en" },
  { value: "base", label: "base" },
  { value: "small.en", label: "small.en" },
  { value: "small", label: "small" },
  { value: "medium.en", label: "medium.en" },
  { value: "medium", label: "medium" },
  { value: "large-v1", label: "large-v1" },
  { value: "large-v2", label: "large-v2" },
  { value: "large-v3", label: "large-v3" },
  { value: "large", label: "large" },
  { value: "distil-small.en", label: "distil-small.en" },
  { value: "distil-medium.en", label: "distil-medium.en" },
  { value: "distil-large-v2", label: "distil-large-v2" },
  { value: "distil-large-v3", label: "distil-large-v3" },
  { value: "distil-large-v3.5", label: "distil-large-v3.5" },
  { value: "large-v3-turbo", label: "large-v3-turbo" },
  { value: "turbo", label: "turbo" },
] as const;

const LOCAL_WHISPER_DEVICE_OPTIONS = [
  {
    value: "auto",
    labelKey: "settingsAiLocalWhisperDeviceAuto",
    descriptionKey: "settingsAiLocalWhisperDeviceAutoDescription",
  },
  {
    value: "cpu",
    labelKey: "settingsAiLocalWhisperDeviceCpu",
    descriptionKey: "settingsAiLocalWhisperDeviceCpuDescription",
  },
  {
    value: "cuda",
    labelKey: "settingsAiLocalWhisperDeviceCuda",
    descriptionKey: "settingsAiLocalWhisperDeviceCudaDescription",
  },
] as const;

const LOCAL_WHISPER_COMPUTE_TYPE_OPTIONS = [
  {
    value: "default",
    label: "default",
    descriptionKey: "settingsAiLocalWhisperComputeTypeDefaultDescription",
  },
  {
    value: "auto",
    label: "auto",
    descriptionKey: "settingsAiLocalWhisperComputeTypeAutoDescription",
  },
  {
    value: "int8",
    label: "int8",
    descriptionKey: "settingsAiLocalWhisperComputeTypeInt8Description",
  },
  {
    value: "int8_float32",
    label: "int8_float32",
    descriptionKey: "settingsAiLocalWhisperComputeTypeInt8Float32Description",
  },
  {
    value: "int8_float16",
    label: "int8_float16",
    descriptionKey: "settingsAiLocalWhisperComputeTypeInt8Float16Description",
  },
  {
    value: "int8_bfloat16",
    label: "int8_bfloat16",
    descriptionKey: "settingsAiLocalWhisperComputeTypeInt8Bfloat16Description",
  },
  {
    value: "int16",
    label: "int16",
    descriptionKey: "settingsAiLocalWhisperComputeTypeInt16Description",
  },
  {
    value: "float16",
    label: "float16",
    descriptionKey: "settingsAiLocalWhisperComputeTypeFloat16Description",
  },
  {
    value: "bfloat16",
    label: "bfloat16",
    descriptionKey: "settingsAiLocalWhisperComputeTypeBfloat16Description",
  },
  {
    value: "float32",
    label: "float32",
    descriptionKey: "settingsAiLocalWhisperComputeTypeFloat32Description",
  },
] as const;

function isPresetLocalWhisperModel(value: string): boolean {
  return LOCAL_WHISPER_MODEL_OPTIONS.some((option) => option.value === value);
}

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
    <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E3DB] bg-[#FCF9F5] px-2.5 py-1.5 text-sm text-[#32332D]">
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
  everyoneLabel,
  notSetLabel,
  selectedIds,
  targetMembers,
}: {
  allSelected: boolean;
  everyoneLabel: string;
  notSetLabel: string;
  selectedIds: string[];
  targetMembers: AuthMember[];
}) {
  if (allSelected) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#D9D4CD] bg-[#F4EFE8] px-3 py-1.5 text-sm font-medium text-[#2D2926]">
        <span className="material-symbols-outlined text-[18px] text-[#7D746D]">
          groups
        </span>
        {everyoneLabel}
      </div>
    );
  }

  const selectedMembers = targetMembers.filter((member) =>
    selectedIds.includes(member.id),
  );

  if (selectedMembers.length === 0) {
    return <span className="text-sm text-[#9C9288]">{notSetLabel}</span>;
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
  const { t } = usePreferences();

  return (
    <div aria-label={`${memberName} ${label}`} className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5F5F59]">{label}</p>
      <button
        aria-expanded={open}
        aria-label={t("settingsPermissionPickTargetsAria", { memberName, label })}
        className="flex w-full items-center justify-between rounded-xl border border-[#D9D4CD] bg-[#FCF9F5] px-4 py-3 text-left transition hover:border-[#B3B2AB] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onToggleOpen}
        type="button"
      >
        <AvatarPreview
          allSelected={allSelected}
          everyoneLabel={t("settingsPermissionEveryone")}
          notSetLabel={t("settingsPermissionNotSet")}
          selectedIds={selectedIds}
          targetMembers={targetMembers}
        />
        <span className="material-symbols-outlined text-[18px] text-[#7D746D]">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="rounded-xl border border-[#D9D4CD] bg-white p-3 shadow-sm">
          <div className="space-y-2">
            <button
              aria-label={t("settingsPermissionToggleEveryoneAria", { label })}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition ${
                allSelected
                  ? "bg-[#F0EEE8] text-[#32332D]"
                  : "hover:bg-[#F8F3EE] text-[#32332D]"
              }`}
              disabled={disabled || saving}
              onClick={onToggleAll}
              type="button"
            >
              <span className="inline-flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4EFE8] text-[#7D746D]">
                  <span className="material-symbols-outlined text-[18px]">groups</span>
                </span>
                <span className="font-medium">{t("settingsPermissionEveryone")}</span>
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
                  aria-label={t("settingsPermissionToggleMemberAria", {
                    label,
                    name: member.name,
                  })}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition ${
                    isSelected
                      ? "bg-[#FBF8F5] text-[#32332D]"
                      : "hover:bg-[#F8F3EE] text-[#32332D]"
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
                        <span className="text-xs text-[#9C9288]">
                          {t("settingsPermissionWriteInheritedHint")}
                        </span>
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
  caption,
  label,
  onClick,
}: {
  active: boolean;
  caption?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center justify-between rounded-xl border-2 px-6 py-7 text-left transition ${
        active
          ? "border-[#615E57] bg-white text-[#615E57] shadow-sm"
          : "border-transparent bg-[#F6F3EE] text-[#32332D] hover:border-[#B3B2AB]/50"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex flex-col">
        <span className={`text-lg font-bold ${active ? "text-[#615E57]" : "text-[#32332D]"}`}>
          {label}
        </span>
        {caption ? (
          <span className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[#5F5F59]">
            {caption}
          </span>
        ) : null}
      </span>
      {active ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#615E57] text-white">
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
            check
          </span>
        </span>
      ) : null}
    </button>
  );
}

function MemberPermissionRow({
  expanded,
  member,
  members,
  session,
  showDeleteMember,
  deletingMember,
  onDeleteMember,
  onToggleExpand,
}: {
  expanded: boolean;
  member: AuthMember;
  members: AuthMember[];
  session: AuthSession;
  showDeleteMember: boolean;
  deletingMember: boolean;
  onDeleteMember: () => void;
  onToggleExpand: () => void;
}) {
  const [grants, setGrants] = useState<MemberPermissionGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<"read" | "write" | null>(null);
  const readPickerRef = useRef<HTMLDivElement | null>(null);
  const writePickerRef = useRef<HTMLDivElement | null>(null);
  const { t } = usePreferences();

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
              : t("settingsMembersPermissionLoadError"),
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
  }, [expanded, member.user_account_id, members, session, t]);

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
          : t("settingsMembersPermissionSaveError"),
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
    <div
      className={`overflow-hidden rounded-xl ${
        expanded
          ? "bg-[#F0EEE8] ring-1 ring-[#615E57]/5"
          : "bg-[#F6F3EE]"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-4 px-6 py-6 transition ${
          expanded ? "border-b border-[#32332D]/5" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white text-lg font-bold text-white shadow-sm"
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
                    : "border-[#D9D4CD] bg-[#FCF9F5] text-[#7B7B74]"
                }`}
              >
                {member.user_account_id
                  ? t("homePermissionBound")
                  : t("homePermissionNotBound")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showDeleteMember && (
            <button
              aria-label={t("settingsMembersDeleteMemberAria", { name: member.name })}
              className="flex items-center justify-center rounded-full p-2 text-[#9C9288] transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={deletingMember}
              onClick={onDeleteMember}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          )}
          <button
            aria-label={
              expanded
                ? t("settingsMembersCollapsePermissionsAria", { name: member.name })
                : t("settingsMembersExpandPermissionsAria", { name: member.name })
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
      </div>

      {expanded && (
        <div className="space-y-6 px-8 py-8">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {!member.user_account_id && (
            <div className="rounded-lg border border-[#D9D4CD] bg-[#FCF9F5] px-4 py-4 text-sm text-[#5F5F59]">
              {t("settingsMembersUnboundNoPermissions")}
            </div>
          )}

          {member.user_account_id && loading && (
            <div className="rounded-lg border border-[#D9D4CD] bg-[#FCF9F5] px-4 py-5 text-sm text-[#5F5F59]">
              {t("settingsMembersPermissionLoading")}
            </div>
          )}

          {member.user_account_id && !loading && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-t border-[#32332D]/5 py-4 first:border-t-0">
                <span className="text-sm font-semibold text-[#32332D]">
                  {t("settingsMembersPermissionHeading")}
                </span>
                <button
                  aria-label={t("settingsMembersToggleManageAllAria", { name: member.name })}
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

              <div className="grid gap-6 lg:grid-cols-2">
                <div ref={readPickerRef}>
                  <PermissionPicker
                    allSelected={selection.readAll}
                    disabled={!canEdit || selection.manageAll}
                    label={t("homePermissionRead")}
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
                    label={t("homePermissionWrite")}
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

function EnvConfiguredBadge() {
  const { t } = usePreferences();
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
      {t("settingsAiEnvConfiguredBadge")}
    </span>
  );
}

export function SettingsSheet({
  open,
  onClose,
  members,
  session,
  onMembersChange,
  onFamilySpaceDeleted,
}: SettingsSheetProps) {
  const { language, setLanguage, t } = usePreferences();
  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [healthSummaryRefreshTime, setHealthSummaryRefreshTime] = useState("05:00");
  const [carePlanRefreshTime, setCarePlanRefreshTime] = useState("06:00");
  const [aiDefaultLanguage, setAiDefaultLanguage] = useState<AppLanguage>("en");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isLoadingAdminSettings, setIsLoadingAdminSettings] = useState(false);
  const [isSavingAdminSettings, setIsSavingAdminSettings] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
  const [sttProvider, setSttProvider] = useState<TranscriptionProvider>("openai");
  const [sttApiKey, setSttApiKey] = useState("");
  const [sttModel, setSttModel] = useState("gpt-4o-mini-transcribe");
  const [sttLanguage, setSttLanguage] = useState("zh");
  const [sttTimeout, setSttTimeout] = useState("30");
  const [localWhisperModel, setLocalWhisperModel] = useState("small");
  const [isCustomLocalWhisperModel, setIsCustomLocalWhisperModel] = useState(false);
  const [localWhisperDevice, setLocalWhisperDevice] = useState("auto");
  const [localWhisperComputeType, setLocalWhisperComputeType] = useState("default");
  const [localWhisperDownloadRoot, setLocalWhisperDownloadRoot] = useState("");
  const [localWhisperProbe, setLocalWhisperProbe] =
    useState<LocalWhisperModelStatus | null>(null);
  const [localWhisperProbeLoading, setLocalWhisperProbeLoading] = useState(false);
  const [localWhisperDownloadLoading, setLocalWhisperDownloadLoading] = useState(false);
  const [localWhisperProbeError, setLocalWhisperProbeError] = useState<string | null>(
    null,
  );
  const localWhisperProbeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [chatBaseUrl, setChatBaseUrl] = useState("");
  const [chatBaseUrlSource, setChatBaseUrlSource] = useState<"env" | "db" | null>(null);
  const [chatApiKey, setChatApiKey] = useState("");
  const [chatApiKeySource, setChatApiKeySource] = useState<"env" | "db" | null>(null);
  const [chatModel, setChatModel] = useState("gpt-4.1-mini");
  const [chatModelSource, setChatModelSource] = useState<"env" | "db" | null>(null);
  const [sttApiKeySource, setSttApiKeySource] = useState<"env" | "db" | null>(null);
  const [preferencesSectionOpen, setPreferencesSectionOpen] = useState(true);
  const [adminChatSectionOpen, setAdminChatSectionOpen] = useState(true);
  const [adminTranscriptionSectionOpen, setAdminTranscriptionSectionOpen] =
    useState(true);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [memberPendingDelete, setMemberPendingDelete] = useState<AuthMember | null>(
    null,
  );
  const [familySpaceDeleteExpanded, setFamilySpaceDeleteExpanded] = useState(false);
  const [isDeletingFamilySpace, setIsDeletingFamilySpace] = useState(false);
  const [familySpaceDeleteError, setFamilySpaceDeleteError] = useState<string | null>(
    null,
  );
  const [isPersistingSttProvider, setIsPersistingSttProvider] = useState(false);

  const latestRefreshTimesRef = useRef({
    health: healthSummaryRefreshTime,
    care: carePlanRefreshTime,
    aiDefaultLanguage,
  });
  const refreshPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiFormRef = useRef({
    sttProvider: "openai" as TranscriptionProvider,
    sttApiKey: "",
    sttModel: "",
    sttLanguage: "",
    sttTimeout: "",
    localWhisperModel: "",
    localWhisperDevice: "",
    localWhisperComputeType: "",
    localWhisperDownloadRoot: "",
    chatBaseUrl: "",
    chatApiKey: "",
    chatModel: "",
  });
  const aiPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  latestRefreshTimesRef.current.health = healthSummaryRefreshTime;
  latestRefreshTimesRef.current.care = carePlanRefreshTime;
  latestRefreshTimesRef.current.aiDefaultLanguage = aiDefaultLanguage;
  aiFormRef.current = {
    sttProvider,
    sttApiKey,
    sttModel,
    sttLanguage,
    sttTimeout,
    localWhisperModel,
    localWhisperDevice,
    localWhisperComputeType,
    localWhisperDownloadRoot,
    chatBaseUrl,
    chatApiKey,
    chatModel,
  };

  const isAdmin = session.user.role === "admin";
  const visibleTabs = TAB_DEFINITIONS.filter((tab) => !tab.adminOnly || isAdmin);

  useEffect(() => {
    if (visibleTabs.some((tab) => tab.key === activeTab)) {
      return;
    }

    setActiveTab(visibleTabs[0]?.key ?? "preferences");
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    return () => {
      if (refreshPersistTimerRef.current) {
        clearTimeout(refreshPersistTimerRef.current);
      }
      if (aiPersistTimerRef.current) {
        clearTimeout(aiPersistTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }

    document.body.style.overflow = "";
    setActiveTab("preferences");
    setExpandedMemberIds([]);
    setShowAddForm(false);
    setAddName("");
    setAddError(null);
    setSettingsError(null);
    setAiError(null);
    setMemberPendingDelete(null);
    setFamilySpaceDeleteExpanded(false);
    setFamilySpaceDeleteError(null);
    setLocalWhisperProbe(null);
    setLocalWhisperProbeLoading(false);
    setLocalWhisperProbeError(null);

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function applyAdminSettings(nextSettings: AdminSettings) {
    setHealthSummaryRefreshTime(nextSettings.health_summary_refresh_time);
    setCarePlanRefreshTime(nextSettings.care_plan_refresh_time);
    setAiDefaultLanguage(nextSettings.ai_default_language);
    setSttProvider(nextSettings.transcription.provider);
    setSttApiKey(nextSettings.transcription.api_key ?? "");
    setSttApiKeySource(nextSettings.transcription.api_key_source ?? null);
    setSttModel(nextSettings.transcription.model);
    setSttLanguage(nextSettings.transcription.language ?? "");
    setSttTimeout(String(nextSettings.transcription.timeout));
    setLocalWhisperModel(nextSettings.transcription.local_whisper_model);
    setIsCustomLocalWhisperModel(
      !isPresetLocalWhisperModel(nextSettings.transcription.local_whisper_model),
    );
    setLocalWhisperDevice(nextSettings.transcription.local_whisper_device);
    setLocalWhisperComputeType(nextSettings.transcription.local_whisper_compute_type);
    setLocalWhisperDownloadRoot(
      nextSettings.transcription.local_whisper_download_root ?? "",
    );
    setChatBaseUrl(nextSettings.chat_model.base_url ?? "");
    setChatBaseUrlSource(nextSettings.chat_model.base_url_source ?? null);
    setChatApiKey(nextSettings.chat_model.api_key ?? "");
    setChatApiKeySource(nextSettings.chat_model.api_key_source ?? null);
    setChatModel(nextSettings.chat_model.model);
    setChatModelSource(nextSettings.chat_model.model_source ?? null);
  }

  useEffect(() => {
    if (!open || !isAdmin || activeTab !== "admin") {
      return;
    }

    let cancelled = false;

    async function loadAdminSettings() {
      setIsLoadingAdminSettings(true);
      setSettingsError(null);
      setAiError(null);
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
              : t("settingsAiLoadError");
          setSettingsError(message);
          setAiError(message);
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

  const runLocalWhisperProbe = useCallback(async () => {
    if (sttProvider !== "local_whisper") {
      return;
    }
    const model = localWhisperModel.trim();
    if (!model) {
      setLocalWhisperProbe(null);
      setLocalWhisperProbeError(null);
      return;
    }
    setLocalWhisperProbeLoading(true);
    setLocalWhisperProbeError(null);
    try {
      const result = await getLocalWhisperModelStatus(session, {
        model: localWhisperModel,
        downloadRoot: localWhisperDownloadRoot,
      });
      setLocalWhisperProbe(result);
    } catch (error) {
      setLocalWhisperProbe(null);
      const message =
        error instanceof Error ? error.message : t("settingsAiLocalWhisperCheckFailed");
      setLocalWhisperProbeError(message);
    } finally {
      setLocalWhisperProbeLoading(false);
    }
  }, [
    localWhisperDownloadRoot,
    localWhisperModel,
    session,
    sttProvider,
    t,
  ]);

  const handleDownloadLocalWhisperModel = useCallback(async () => {
    if (sttProvider !== "local_whisper") {
      return;
    }
    const model = localWhisperModel.trim();
    if (!model) {
      return;
    }
    setLocalWhisperDownloadLoading(true);
    setLocalWhisperProbeError(null);
    try {
      await downloadLocalWhisperModel(session, {
        model,
        downloadRoot: localWhisperDownloadRoot,
      });
      await runLocalWhisperProbe();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("settingsAiLocalWhisperCheckFailed");
      setLocalWhisperProbeError(message);
    } finally {
      setLocalWhisperDownloadLoading(false);
    }
  }, [
    localWhisperDownloadRoot,
    localWhisperModel,
    runLocalWhisperProbe,
    session,
    sttProvider,
    t,
  ]);

  useEffect(() => {
    if (sttProvider !== "local_whisper") {
      setLocalWhisperProbe(null);
      setLocalWhisperProbeError(null);
      setLocalWhisperProbeLoading(false);
    }
  }, [sttProvider]);

  useEffect(() => {
    if (!open || !isAdmin || activeTab !== "admin" || sttProvider !== "local_whisper") {
      if (localWhisperProbeTimerRef.current) {
        clearTimeout(localWhisperProbeTimerRef.current);
        localWhisperProbeTimerRef.current = null;
      }
      return;
    }
    const model = localWhisperModel.trim();
    if (!model) {
      setLocalWhisperProbe(null);
      setLocalWhisperProbeError(null);
      return;
    }
    if (localWhisperProbeTimerRef.current) {
      clearTimeout(localWhisperProbeTimerRef.current);
    }
    localWhisperProbeTimerRef.current = setTimeout(() => {
      localWhisperProbeTimerRef.current = null;
      void runLocalWhisperProbe();
    }, 400);
    return () => {
      if (localWhisperProbeTimerRef.current) {
        clearTimeout(localWhisperProbeTimerRef.current);
      }
    };
  }, [
    activeTab,
    isAdmin,
    localWhisperDownloadRoot,
    localWhisperModel,
    open,
    runLocalWhisperProbe,
    sttProvider,
  ]);

  function schedulePersistRefreshTimes() {
    if (refreshPersistTimerRef.current) {
      clearTimeout(refreshPersistTimerRef.current);
    }
    refreshPersistTimerRef.current = setTimeout(() => {
      refreshPersistTimerRef.current = null;
      const { health, care, aiDefaultLanguage: nextLanguage } = latestRefreshTimesRef.current;
      void persistRefreshTimes(health, care, nextLanguage);
    }, 450);
  }

  async function persistRefreshTimes(
    health: string,
    care: string,
    nextLanguage: AppLanguage,
  ) {
    setIsSavingAdminSettings(true);
    setSettingsError(null);
    try {
      const nextSettings = await updateAdminSettings(session, {
        health_summary_refresh_time: health,
        care_plan_refresh_time: care,
        ai_default_language: nextLanguage,
      });
      setHealthSummaryRefreshTime(nextSettings.health_summary_refresh_time);
      setCarePlanRefreshTime(nextSettings.care_plan_refresh_time);
      setAiDefaultLanguage(nextSettings.ai_default_language);
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : t("settingsTimeSaveError"),
      );
    } finally {
      setIsSavingAdminSettings(false);
    }
  }

  function schedulePersistAiSettings() {
    if (aiPersistTimerRef.current) {
      clearTimeout(aiPersistTimerRef.current);
    }
    aiPersistTimerRef.current = setTimeout(() => {
      aiPersistTimerRef.current = null;
      void persistAiSettings();
    }, 500);
  }

  async function persistAiSettings() {
    const snap = aiFormRef.current;
    setIsSavingAiSettings(true);
    setAiError(null);
    try {
      const nextSettings = await updateAdminSettings(session, {
        transcription: {
          provider: snap.sttProvider,
          api_key: snap.sttApiKey || null,
          model: snap.sttModel || null,
          language: snap.sttLanguage || null,
          timeout: Number(snap.sttTimeout),
          local_whisper_model: snap.localWhisperModel || null,
          local_whisper_device: snap.localWhisperDevice || null,
          local_whisper_compute_type: snap.localWhisperComputeType || null,
          local_whisper_download_root: snap.localWhisperDownloadRoot || null,
        },
        chat_model: {
          base_url: snap.chatBaseUrl || null,
          api_key: snap.chatApiKey || null,
          model: snap.chatModel || null,
        },
      });
      applyAdminSettings(nextSettings);
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : t("settingsAiSaveError"),
      );
    } finally {
      setIsSavingAiSettings(false);
    }
  }

  async function handleSelectTranscriptionProvider(
    provider: TranscriptionProvider,
  ) {
    if (
      provider === sttProvider ||
      isPersistingSttProvider ||
      isSavingAiSettings ||
      isLoadingAdminSettings
    ) {
      return;
    }

    const previous = sttProvider;
    setSttProvider(provider);
    setIsPersistingSttProvider(true);
    setAiError(null);
    try {
      const nextSettings = await updateAdminSettings(session, {
        transcription: { provider },
      });
      applyAdminSettings(nextSettings);
    } catch (error) {
      setSttProvider(previous);
      setAiError(
        error instanceof Error ? error.message : t("settingsAiSaveError"),
      );
    } finally {
      setIsPersistingSttProvider(false);
    }
  }

  async function handleLanguageChange(nextLanguage: AppLanguage) {
    if (nextLanguage === language) {
      return;
    }

    const previousLanguage = language;
    setLanguage(nextLanguage);
    try {
      const updatedPreferences = await updateUserPreferences(session, {
        preferred_language: nextLanguage,
      });
      writeSession({
        ...session,
        user: {
          ...session.user,
          preferred_language: updatedPreferences.preferred_language,
        },
      });
    } catch (error) {
      setLanguage(previousLanguage);
      console.error(error instanceof Error ? error.message : t("settingsTimeSaveError"));
    }
  }

  async function executeConfirmedMemberDelete() {
    const member = memberPendingDelete;
    if (!member || !isAdmin || member.id === session.member.id) {
      setMemberPendingDelete(null);
      return;
    }

    setMemberPendingDelete(null);
    setDeletingMemberId(member.id);
    setAddError(null);
    try {
      await deleteMember(session, member.id);
      onMembersChange(members.filter((m) => m.id !== member.id));
      setExpandedMemberIds((ids) => ids.filter((id) => id !== member.id));
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : t("settingsMembersDeleteError"),
      );
    } finally {
      setDeletingMemberId(null);
    }
  }

  async function executeDeleteFamilySpace() {
    if (!isAdmin || isDeletingFamilySpace) {
      return;
    }

    setIsDeletingFamilySpace(true);
    setFamilySpaceDeleteError(null);
    try {
      await deleteFamilySpace(session);
      setFamilySpaceDeleteExpanded(false);
      onFamilySpaceDeleted?.();
      onClose();
    } catch (error) {
      setFamilySpaceDeleteError(
        error instanceof Error
          ? error.message
          : t("settingsAdminDeleteFamilySpaceError"),
      );
    } finally {
      setIsDeletingFamilySpace(false);
    }
  }

  const tabLabels: Record<SettingsTab, string> = {
    preferences: t("settingsTabPreferences"),
    members: t("settingsTabMembers"),
    admin: t("settingsTabAdmin"),
  };
  const languageOptions: Array<{ value: AppLanguage; label: string }> = [
    { value: "zh", label: t("settingsLanguageChinese") },
    { value: "en", label: t("settingsLanguageEnglish") },
  ];
  const localWhisperModelSelectValue = isCustomLocalWhisperModel
    ? CUSTOM_LOCAL_WHISPER_MODEL_VALUE
    : localWhisperModel;
  const selectedLocalWhisperDevice =
    LOCAL_WHISPER_DEVICE_OPTIONS.find((option) => option.value === localWhisperDevice) ??
    LOCAL_WHISPER_DEVICE_OPTIONS[0];
  const selectedLocalWhisperComputeType =
    LOCAL_WHISPER_COMPUTE_TYPE_OPTIONS.find(
      (option) => option.value === localWhisperComputeType,
    ) ?? LOCAL_WHISPER_COMPUTE_TYPE_OPTIONS[0];
  const adminCardClass =
    "overflow-hidden rounded-xl bg-[#F0EEE8] ring-1 ring-[#615E57]/5";
  const adminFieldClass =
    "mt-2 w-full rounded-lg border border-[#D9D4CD] bg-white px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#615E57] focus:ring-1 focus:ring-[#615E57]";
  const adminFieldRowInputClass =
    "w-full min-w-0 flex-1 rounded-lg border border-[#D9D4CD] bg-white px-4 py-3 text-sm text-[#2D2926] outline-none transition focus:border-[#615E57] focus:ring-1 focus:ring-[#615E57]";
  const adminInlineInputClass =
    "w-full rounded-lg border border-[#D9D4CD] bg-[#FCF9F5] px-4 py-2.5 text-sm text-[#2D2926] outline-none transition focus:border-[#615E57] focus:ring-1 focus:ring-[#615E57] md:w-[150px]";

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

  const sharedAdminError =
    settingsError && aiError && settingsError === aiError ? settingsError : null;
  const timeSectionError = sharedAdminError ? null : settingsError;
  const aiSectionError = sharedAdminError ? null : aiError;

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
        className="relative flex h-[85vh] max-h-[calc(100dvh-2rem)] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-panel border border-white/60 bg-white shadow-[0_32px_64px_rgba(50,51,45,0.06)] md:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        <aside className="shrink-0 border-b border-[#E4E3DB] bg-[#F6F3EE] px-8 py-8 md:flex md:w-64 md:flex-col md:border-b-0 md:border-r md:px-0">
          <div className="mb-8 px-8">
            <h2 className="text-xl font-black tracking-tight text-[#615E57]">
              {t("settingsTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#5F5F59]/70">
              {t("settingsSidebarDescription")}
            </p>
          </div>

          <nav className="flex flex-col gap-1">
            {visibleTabs.map((tab) => (
              <button
                className={`flex items-center gap-3 px-8 py-3 text-left text-sm font-semibold tracking-tight transition ${
                  activeTab === tab.key
                    ? "border-r-2 border-[#615E57] bg-[#EAE8E1] text-[#615E57] scale-[0.985]"
                    : "text-[#5F5F59]/70 hover:bg-[#F0EEE8] hover:text-[#615E57]"
                }`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`material-symbols-outlined text-[18px] ${
                    activeTab === tab.key ? "text-[#615E57]" : "text-[#8E8B84]"
                  }`}
                >
                  {tab.icon}
                </span>
                <span>{tabLabels[tab.key]}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col bg-[#FCF9F5]">
          <header className="flex shrink-0 items-start justify-between border-b border-[#E4E3DB] bg-[#FCF9F5]/90 px-6 py-7 backdrop-blur md:px-10 md:py-8">
            <div className="space-y-1">
              {activeTab === "preferences" && (
                <>
                  <h3 className="text-2xl font-bold tracking-tight text-[#615E57]">
                    {t("settingsPreferencesTitle")}
                  </h3>
                  <p className="max-w-3xl text-sm leading-7 text-[#5F5F59]">
                    {t("settingsPreferencesDescription")}
                  </p>
                </>
              )}
              {activeTab === "members" && (
                <>
                  <h3 className="text-2xl font-bold tracking-tight text-[#615E57]">
                    {t("settingsMembersTitle")}
                  </h3>
                  <p className="max-w-3xl text-sm leading-7 text-[#5F5F59]">
                    {t("settingsMembersDescription")}
                  </p>
                </>
              )}
              {activeTab === "admin" && isAdmin && (
                <>
                  <h3 className="text-2xl font-bold tracking-tight text-[#615E57]">
                    {t("settingsAdminTitle")}
                  </h3>
                  <p className="max-w-3xl text-sm leading-7 text-[#5F5F59]">
                    {t("settingsAdminDescription")}
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {activeTab === "members" && isAdmin && !showAddForm && (
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-[#615E57] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4F4B45]"
                  onClick={() => setShowAddForm(true)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    person_add
                  </span>
                  {t("settingsMembersAdd")}
                </button>
              )}

              <button
                aria-label={t("settingsClose")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#5F5F59] transition hover:bg-[#F0EEE8] hover:text-[#32332D]"
                onClick={onClose}
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-[#FCF9F5] px-6 py-6 no-scrollbar md:px-10 md:pb-12">
          {activeTab === "members" && (
            <div className="mx-auto max-w-5xl space-y-4">
              {memberPendingDelete && (
                <div
                  aria-live="polite"
                  className="rounded-xl border border-[#D9D4CD] bg-[#FCF9F5] px-5 py-4 ring-1 ring-[#615E57]/10"
                  role="region"
                >
                  <p className="text-sm font-medium text-[#32332D]">
                    {t("settingsMembersDeleteConfirm", {
                      name: memberPendingDelete.name,
                    })}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-[#5F5F59] transition hover:bg-[#EAE8E1]"
                      onClick={() => setMemberPendingDelete(null)}
                      type="button"
                    >
                      {t("settingsMembersAddCancel")}
                    </button>
                    <button
                      className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={deletingMemberId !== null}
                      onClick={() => void executeConfirmedMemberDelete()}
                      type="button"
                    >
                      {t("settingsMembersDeleteMember")}
                    </button>
                  </div>
                </div>
              )}

              {showAddForm && (
                <form
                  className="rounded-xl bg-[#F0EEE8] p-4 ring-1 ring-[#615E57]/5"
                  onSubmit={handleAddMember}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      autoFocus
                      className="min-w-[180px] flex-1 rounded-lg border border-[#D9D0C6] bg-white px-4 py-2.5 text-sm text-[#2D2926] outline-none transition focus:border-[#615E57] focus:ring-1 focus:ring-[#615E57]"
                      disabled={addLoading}
                      onChange={(event) => setAddName(event.target.value)}
                      placeholder={t("settingsMembersNamePlaceholder")}
                      type="text"
                      value={addName}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg px-4 py-2 text-sm text-[#7D746D] transition hover:bg-[#EAE8E1]"
                        disabled={addLoading}
                        onClick={() => {
                          setShowAddForm(false);
                          setAddName("");
                          setAddError(null);
                        }}
                        type="button"
                      >
                        {t("settingsMembersAddCancel")}
                      </button>
                      <button
                        className="rounded-lg bg-[#615E57] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4F4B45] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!addName.trim() || addLoading}
                        type="submit"
                      >
                        {addLoading
                          ? t("settingsMembersAddSubmitting")
                          : t("settingsMembersAddSubmit")}
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

              <div className="space-y-4">
                {members.map((member) => (
                  <MemberPermissionRow
                    deletingMember={deletingMemberId === member.id}
                    expanded={expandedMemberIds.includes(member.id)}
                    key={member.id}
                    member={member}
                    members={members}
                    onDeleteMember={() => setMemberPendingDelete(member)}
                    onToggleExpand={() => toggleExpandedMember(member.id)}
                    session={session}
                    showDeleteMember={
                      isAdmin && member.id !== session.member.id
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="mx-auto max-w-4xl">
              <section className="overflow-hidden rounded-xl bg-[#F0EEE8] ring-1 ring-[#615E57]/5">
                <button
                  aria-expanded={preferencesSectionOpen}
                  aria-label={t("settingsLanguageCardTitle")}
                  className="flex w-full items-center justify-between p-6 text-left transition hover:bg-[#EAE8E1]/40"
                  onClick={() => setPreferencesSectionOpen((open) => !open)}
                  type="button"
                >
                  <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAE8E1] text-[#615E57] shadow-sm">
                      <span className="material-symbols-outlined text-2xl">
                        language
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-[#615E57]">
                        {t("settingsLanguageCardTitle")}
                      </h3>
                      <p className="text-xs font-medium text-[#5F5F59]">
                        {t("settingsLanguageCardDescription")}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#615E57]">
                    {preferencesSectionOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {preferencesSectionOpen && (
                  <div className="border-t border-[#32332D]/5 px-8 pb-8 pt-6">
                    <section className="space-y-6">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-bold text-[#32332D]">
                          {t("settingsSectionLanguage")}
                        </h4>
                        <p className="text-xs text-[#5F5F59]">
                          {t("settingsSectionLanguageDescription")}
                        </p>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        {languageOptions.map((option) => (
                          <PreferenceChoiceButton
                            active={language === option.value}
                            caption={
                              option.value === "zh"
                                ? t("settingsLanguageCurrentTag")
                                : t("settingsLanguageEnglishTag")
                            }
                            key={option.value}
                            label={option.label}
                            onClick={() => void handleLanguageChange(option.value)}
                          />
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "admin" && isAdmin && (
            <div className="mx-auto max-w-5xl space-y-4">
              {sharedAdminError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {sharedAdminError}
                </p>
              )}

              <section className="rounded-xl bg-[#F6F3EE]">
                <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAE8E1] text-[#615E57] shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">
                        calendar_today
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold text-[#32332D]">
                        {t("settingsTimeCarePlan")}
                      </h4>
                      <p className="text-sm text-[#5F5F59]">
                        {t("settingsTimeCarePlanDescription")}
                      </p>
                    </div>
                  </div>

                  <label className="block md:w-auto">
                    <span className="sr-only">{t("settingsTimeCarePlan")}</span>
                    <input
                      aria-label={t("settingsTimeCarePlan")}
                      className={adminInlineInputClass}
                      disabled={isLoadingAdminSettings || isSavingAdminSettings}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCarePlanRefreshTime(value);
                        latestRefreshTimesRef.current = {
                          health: healthSummaryRefreshTime,
                          care: value,
                          aiDefaultLanguage,
                        };
                        schedulePersistRefreshTimes();
                      }}
                      type="time"
                      value={carePlanRefreshTime}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl bg-[#F6F3EE]">
                <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAE8E1] text-[#615E57] shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">
                        health_and_safety
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold text-[#32332D]">
                        {t("settingsTimeHealthSummary")}
                      </h4>
                      <p className="text-sm text-[#5F5F59]">
                        {t("settingsTimeHealthSummaryDescription")}
                      </p>
                    </div>
                  </div>

                  <label className="block md:w-auto">
                    <span className="sr-only">{t("settingsTimeHealthSummary")}</span>
                    <input
                      aria-label={t("settingsTimeHealthSummary")}
                      className={adminInlineInputClass}
                      disabled={isLoadingAdminSettings || isSavingAdminSettings}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHealthSummaryRefreshTime(value);
                        latestRefreshTimesRef.current = {
                          health: value,
                          care: carePlanRefreshTime,
                          aiDefaultLanguage,
                        };
                        schedulePersistRefreshTimes();
                      }}
                      type="time"
                      value={healthSummaryRefreshTime}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl bg-[#F6F3EE]">
                <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAE8E1] text-[#615E57] shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">
                        translate
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold text-[#32332D]">
                        {t("settingsAiDefaultLanguage")}
                      </h4>
                      <p className="text-sm text-[#5F5F59]">
                        {t("settingsAiDefaultLanguageDescription")}
                      </p>
                    </div>
                  </div>

                  <label className="block md:w-auto">
                    <span className="sr-only">{t("settingsAiDefaultLanguage")}</span>
                    <select
                      aria-label={t("settingsAiDefaultLanguage")}
                      className={adminInlineInputClass}
                      disabled={isLoadingAdminSettings || isSavingAdminSettings}
                      onChange={(event) => {
                        const value = event.target.value as AppLanguage;
                        setAiDefaultLanguage(value);
                        latestRefreshTimesRef.current = {
                          health: healthSummaryRefreshTime,
                          care: carePlanRefreshTime,
                          aiDefaultLanguage: value,
                        };
                        schedulePersistRefreshTimes();
                      }}
                      value={aiDefaultLanguage}
                    >
                      {languageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              {timeSectionError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {timeSectionError}
                </p>
              )}

              {aiSectionError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {aiSectionError}
                </p>
              )}

              <section className={adminCardClass}>
                <button
                  aria-expanded={adminChatSectionOpen}
                  className="flex w-full items-center justify-between p-6 text-left transition hover:bg-[#E8E6DF]/50"
                  onClick={() => setAdminChatSectionOpen((open) => !open)}
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAE8E1] text-[#615E57] shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">
                        chat_bubble_outline
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-[#615E57]">
                        {t("settingsAiSectionChatModel")}
                      </h3>
                      <p className="text-xs font-medium text-[#5F5F59]">
                        {t("settingsAiSectionChatModelDescription")}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#615E57]">
                    {adminChatSectionOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {adminChatSectionOpen && (
                  <div className="border-t border-[#32332D]/5 px-8 pb-8 pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm font-medium text-[#2D2926]">
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {t("settingsAiChatBaseUrl")}
                          {chatBaseUrlSource === "env" && !chatBaseUrl && <EnvConfiguredBadge />}
                        </div>
                        {chatBaseUrlSource === "env" && chatBaseUrl && (
                          <p className="mt-1 text-xs text-amber-600">{t("settingsAiDbPersistHint")}</p>
                        )}
                        <input
                          aria-label={t("settingsAiChatBaseUrl")}
                          className={adminFieldClass}
                          disabled={isLoadingAdminSettings || isSavingAiSettings}
                          onChange={(event) => {
                            setChatBaseUrl(event.target.value);
                            schedulePersistAiSettings();
                          }}
                          type="text"
                          value={chatBaseUrl}
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#2D2926]">
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {t("settingsAiChatApiKey")}
                          {chatApiKeySource === "env" && !chatApiKey && <EnvConfiguredBadge />}
                        </div>
                        {chatApiKeySource === "env" && chatApiKey && (
                          <p className="mt-1 text-xs text-amber-600">{t("settingsAiDbPersistHint")}</p>
                        )}
                        <input
                          aria-label={t("settingsAiChatApiKey")}
                          className={adminFieldClass}
                          disabled={isLoadingAdminSettings || isSavingAiSettings}
                          onChange={(event) => {
                            setChatApiKey(event.target.value);
                            schedulePersistAiSettings();
                          }}
                          type="password"
                          value={chatApiKey}
                        />
                      </label>
                    </div>
                    <label className="mt-4 block text-sm font-medium text-[#2D2926]">
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {t("settingsAiChatModel")}
                        {chatModelSource === "env" && !chatModel && <EnvConfiguredBadge />}
                      </div>
                      {chatModelSource === "env" && chatModel && (
                        <p className="mt-1 text-xs text-amber-600">{t("settingsAiDbPersistHint")}</p>
                      )}
                      <input
                        aria-label={t("settingsAiChatModel")}
                        className={adminFieldClass}
                        disabled={isLoadingAdminSettings || isSavingAiSettings}
                        onChange={(event) => {
                          setChatModel(event.target.value);
                          schedulePersistAiSettings();
                        }}
                        type="text"
                        value={chatModel}
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className={adminCardClass}>
                <button
                  aria-expanded={adminTranscriptionSectionOpen}
                  className="flex w-full items-center justify-between p-6 text-left transition hover:bg-[#E8E6DF]/50"
                  onClick={() =>
                    setAdminTranscriptionSectionOpen((open) => !open)
                  }
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAE8E1] text-[#615E57] shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">
                        record_voice_over
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-[#615E57]">
                        {t("settingsAiSectionTranscription")}
                      </h3>
                      <p className="text-xs font-medium text-[#5F5F59]">
                        {t("settingsAiSectionTranscriptionDescription")}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#615E57]">
                    {adminTranscriptionSectionOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {adminTranscriptionSectionOpen && (
                  <div className="space-y-4 border-t border-[#32332D]/5 px-8 pb-8 pt-6">
                    <div
                      aria-label={t("settingsAiTranscriptionProvider")}
                      className="flex flex-col gap-2"
                      role="radiogroup"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5F5F59]">
                        {t("settingsAiTranscriptionProvider")}
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                        <button
                          aria-checked={sttProvider === "openai"}
                          className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            sttProvider === "openai"
                              ? "border-[#615E57] bg-white text-[#615E57] shadow-sm"
                              : "border-transparent bg-[#F6F3EE] text-[#32332D] hover:border-[#B3B2AB]/50"
                          }`}
                          disabled={
                            isLoadingAdminSettings ||
                            isSavingAiSettings ||
                            isPersistingSttProvider
                          }
                          onClick={() =>
                            void handleSelectTranscriptionProvider("openai")
                          }
                          role="radio"
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[22px] text-[#615E57]"
                          >
                            cloud
                          </span>
                          <span className="text-sm font-semibold">
                            {t("settingsAiTranscriptionProviderOpenAI")}
                          </span>
                        </button>
                        <button
                          aria-checked={sttProvider === "local_whisper"}
                          className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            sttProvider === "local_whisper"
                              ? "border-[#615E57] bg-white text-[#615E57] shadow-sm"
                              : "border-transparent bg-[#F6F3EE] text-[#32332D] hover:border-[#B3B2AB]/50"
                          }`}
                          disabled={
                            isLoadingAdminSettings ||
                            isSavingAiSettings ||
                            isPersistingSttProvider
                          }
                          onClick={() =>
                            void handleSelectTranscriptionProvider("local_whisper")
                          }
                          role="radio"
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[22px] text-[#615E57]"
                          >
                            computer
                          </span>
                          <span className="text-sm font-semibold">
                            {t("settingsAiTranscriptionProviderLocal")}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-[#D9D4CD] bg-[#FCF9F5]/80 p-6">
                      {sttProvider === "openai" && (
                        <>
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block text-sm font-medium text-[#2D2926]">
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                {t("settingsAiTranscriptionApiKey")}
                                {sttApiKeySource === "env" && !sttApiKey && <EnvConfiguredBadge />}
                              </div>
                              {sttApiKeySource === "env" && sttApiKey && (
                                <p className="mt-1 text-xs text-amber-600">{t("settingsAiDbPersistHint")}</p>
                              )}
                              <input
                                aria-label={t("settingsAiTranscriptionApiKey")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                onChange={(event) => {
                                  setSttApiKey(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                type="password"
                                value={sttApiKey}
                              />
                            </label>
                            <label className="block text-sm font-medium text-[#2D2926]">
                              {t("settingsAiTranscriptionModel")}
                              <input
                                aria-label={t("settingsAiTranscriptionModel")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                onChange={(event) => {
                                  setSttModel(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                type="text"
                                value={sttModel}
                              />
                            </label>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block text-sm font-medium text-[#2D2926]">
                              {t("settingsAiTranscriptionLanguage")}
                              <input
                                aria-label={t("settingsAiTranscriptionLanguage")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                onChange={(event) => {
                                  setSttLanguage(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                type="text"
                                value={sttLanguage}
                              />
                            </label>
                            <label className="block text-sm font-medium text-[#2D2926]">
                              {t("settingsAiTranscriptionTimeout")}
                              <input
                                aria-label={t("settingsAiTranscriptionTimeout")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                min="0.1"
                                onChange={(event) => {
                                  setSttTimeout(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                step="0.1"
                                type="number"
                                value={sttTimeout}
                              />
                            </label>
                          </div>
                        </>
                      )}

                      {sttProvider === "local_whisper" && (
                        <>
                          <label className="block text-sm font-medium text-[#2D2926]">
                            {t("settingsAiLocalWhisperModel")}
                            <select
                              aria-label={t("settingsAiLocalWhisperModel")}
                              className={adminFieldClass}
                              disabled={
                                isLoadingAdminSettings || isSavingAiSettings
                              }
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                if (nextValue === CUSTOM_LOCAL_WHISPER_MODEL_VALUE) {
                                  setIsCustomLocalWhisperModel(true);
                                  if (isPresetLocalWhisperModel(localWhisperModel)) {
                                    setLocalWhisperModel("");
                                  }
                                  return;
                                }
                                setIsCustomLocalWhisperModel(false);
                                setLocalWhisperModel(nextValue);
                                schedulePersistAiSettings();
                              }}
                              value={localWhisperModelSelectValue}
                            >
                              {LOCAL_WHISPER_MODEL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                              <option value={CUSTOM_LOCAL_WHISPER_MODEL_VALUE}>
                                {t("settingsAiLocalWhisperModelCustomOption")}
                              </option>
                            </select>
                            <div className="mt-3 space-y-2 rounded-lg border border-[#D9D4CD] bg-[#FCF9F5]/90 px-4 py-3 text-xs leading-5 text-[#5F5F59]">
                              <p>{t("settingsAiLocalWhisperModelRecommendedHint")}</p>
                              <p>{t("settingsAiLocalWhisperModelSmallHint")}</p>
                              <p>{t("settingsAiLocalWhisperModelLargeHint")}</p>
                            </div>
                          </label>

                          {isCustomLocalWhisperModel && (
                            <label className="block text-sm font-medium text-[#2D2926]">
                              {t("settingsAiLocalWhisperCustomModel")}
                              <input
                                aria-label={t("settingsAiLocalWhisperCustomModel")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                onChange={(event) => {
                                  setLocalWhisperModel(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                placeholder={t("settingsAiLocalWhisperCustomModelPlaceholder")}
                                type="text"
                                value={localWhisperModel}
                              />
                              <p className="mt-2 text-xs leading-5 text-[#5F5F59]">
                                {t("settingsAiLocalWhisperCustomModelHint")}
                              </p>
                            </label>
                          )}

                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block text-sm font-medium text-[#2D2926]">
                              {t("settingsAiLocalWhisperDevice")}
                              <select
                                aria-label={t("settingsAiLocalWhisperDevice")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                onChange={(event) => {
                                  setLocalWhisperDevice(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                value={localWhisperDevice}
                              >
                                {LOCAL_WHISPER_DEVICE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {t(option.labelKey)}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-2 text-xs leading-5 text-[#5F5F59]">
                                {t(selectedLocalWhisperDevice.descriptionKey)}
                              </p>
                            </label>
                            <label className="block text-sm font-medium text-[#2D2926]">
                              {t("settingsAiLocalWhisperComputeType")}
                              <select
                                aria-label={t("settingsAiLocalWhisperComputeType")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                onChange={(event) => {
                                  setLocalWhisperComputeType(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                value={localWhisperComputeType}
                              >
                                {LOCAL_WHISPER_COMPUTE_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-2 text-xs leading-5 text-[#5F5F59]">
                                {t(selectedLocalWhisperComputeType.descriptionKey)}
                              </p>
                            </label>
                          </div>

                          <div className="block text-sm font-medium text-[#2D2926]">
                            <span>{t("settingsAiLocalWhisperDownloadRoot")}</span>
                            <input
                              aria-label={t("settingsAiLocalWhisperDownloadRoot")}
                              className={adminFieldClass}
                              disabled={
                                isLoadingAdminSettings || isSavingAiSettings
                              }
                              onChange={(event) => {
                                setLocalWhisperDownloadRoot(event.target.value);
                                schedulePersistAiSettings();
                              }}
                              placeholder=""
                              type="text"
                              value={localWhisperDownloadRoot}
                            />
                            {(localWhisperProbeLoading ||
                              localWhisperDownloadLoading ||
                              localWhisperProbeError ||
                              localWhisperProbe) && (
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                {localWhisperProbeLoading ? (
                                  <span className="text-[#615E57]">
                                    {t("settingsAiLocalWhisperChecking")}
                                  </span>
                                ) : null}
                                {localWhisperDownloadLoading ? (
                                  <span className="text-[#615E57]">
                                    {t("settingsAiLocalWhisperManualDownload")}
                                  </span>
                                ) : null}
                                {localWhisperProbeError ? (
                                  <span className="font-medium text-red-600" role="alert">
                                    {localWhisperProbeError}
                                  </span>
                                ) : null}
                                {!localWhisperProbeLoading &&
                                !localWhisperDownloadLoading &&
                                !localWhisperProbeError &&
                                localWhisperProbe?.present ? (
                                  <span
                                    aria-label={t("settingsAiLocalWhisperModelFound")}
                                    className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                                    role="status"
                                    title={
                                      localWhisperProbe.resolved_path ?? undefined
                                    }
                                  >
                                    {t("settingsAiLocalWhisperModelFound")}
                                  </span>
                                ) : null}
                                {!localWhisperProbeLoading &&
                                !localWhisperDownloadLoading &&
                                !localWhisperProbeError &&
                                localWhisperProbe &&
                                !localWhisperProbe.present ? (
                                  <>
                                    <span className="font-medium text-red-600" role="alert">
                                      {localWhisperProbe.message &&
                                      localWhisperProbe.message !== "Model not found locally."
                                        ? localWhisperProbe.message
                                        : t("settingsAiLocalWhisperModelNotFound")}
                                    </span>
                                    {localWhisperProbe.huggingface_repo_id ? (
                                      <button
                                        className="font-medium text-[#615E57] underline decoration-[#615E57]/40 underline-offset-2 hover:text-[#2D2926] disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={localWhisperDownloadLoading}
                                        onClick={() => {
                                          void handleDownloadLocalWhisperModel();
                                        }}
                                        type="button"
                                      >
                                        {t("settingsAiLocalWhisperManualDownload")}
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            )}
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block text-sm font-medium text-[#2D2926]">
                              {t("settingsAiTranscriptionLanguage")}
                              <input
                                aria-label={t("settingsAiTranscriptionLanguage")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                onChange={(event) => {
                                  setSttLanguage(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                type="text"
                                value={sttLanguage}
                              />
                            </label>
                            <label className="block text-sm font-medium text-[#2D2926]">
                              {t("settingsAiTranscriptionTimeout")}
                              <input
                                aria-label={t("settingsAiTranscriptionTimeout")}
                                className={adminFieldClass}
                                disabled={
                                  isLoadingAdminSettings || isSavingAiSettings
                                }
                                min="0.1"
                                onChange={(event) => {
                                  setSttTimeout(event.target.value);
                                  schedulePersistAiSettings();
                                }}
                                step="0.1"
                                type="number"
                                value={sttTimeout}
                              />
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section
                aria-labelledby="settings-family-space-danger-heading"
                className="mt-6 rounded-2xl border-2 border-red-300 bg-gradient-to-b from-red-50/90 to-white p-6 shadow-sm shadow-red-900/5 md:p-8"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
                  <div className="min-w-0 max-w-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined text-2xl text-red-700"
                      >
                        warning
                      </span>
                      <h3
                        className="text-lg font-bold tracking-tight text-red-900"
                        id="settings-family-space-danger-heading"
                      >
                        {t("settingsAdminDangerZoneTitle")}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed text-red-900/85">
                      {t("settingsAdminDangerZoneDescription")}
                    </p>
                    {familySpaceDeleteError && (
                      <p className="text-sm font-medium text-red-700" role="alert">
                        {familySpaceDeleteError}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 lg:items-end">
                    {!familySpaceDeleteExpanded ? (
                      <button
                        aria-label={t("settingsAdminDeleteFamilySpace")}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-900/25 transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                        onClick={() => {
                          setFamilySpaceDeleteExpanded(true);
                          setFamilySpaceDeleteError(null);
                        }}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="material-symbols-outlined text-[22px]"
                        >
                          delete_forever
                        </span>
                        {t("settingsAdminDeleteFamilySpace")}
                      </button>
                    ) : (
                      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-5 ring-1 ring-red-100 lg:w-[min(100%,22rem)]">
                        <p className="text-sm font-semibold leading-relaxed text-[#32332D]">
                          {t("settingsAdminDeleteFamilySpaceConfirm")}
                        </p>
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <button
                            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#5F5F59] transition hover:bg-[#EAE8E1] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isDeletingFamilySpace}
                            onClick={() => {
                              setFamilySpaceDeleteExpanded(false);
                              setFamilySpaceDeleteError(null);
                            }}
                            type="button"
                          >
                            {t("settingsMembersAddCancel")}
                          </button>
                          <button
                            aria-label={
                              isDeletingFamilySpace
                                ? t("settingsAdminDeleteFamilySpaceDeleting")
                                : t("settingsAdminDeleteFamilySpaceConfirmButton")
                            }
                            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isDeletingFamilySpace}
                            onClick={() => void executeDeleteFamilySpace()}
                            type="button"
                          >
                            {isDeletingFamilySpace
                              ? t("settingsAdminDeleteFamilySpaceDeleting")
                              : t("settingsAdminDeleteFamilySpaceConfirmButton")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
