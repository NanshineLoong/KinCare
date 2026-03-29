import { useEffect, useState } from "react";

import {
  getDashboard,
  refreshDashboardTodayReminders,
  refreshMemberHealthSummaries,
  type DailyGenerationRefreshResponse,
  type DashboardMemberSummary,
  type DashboardReminder,
  type DashboardResponse,
} from "../api/health";
import type { ComposerAttachment } from "../attachments";
import { readyAttachmentContexts } from "../attachments";
import type { AuthMember, AuthSession } from "../auth/session";
import { MaterialIcon } from "../components/MaterialIcon";
import { buildHealthSummaryCards } from "../healthSummaryCards";
import { useComposerAttachments } from "../hooks/useComposerAttachments";
import {
  usePreferences,
  type AppLanguage,
  type TranslationKey,
} from "../preferences";

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
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type HomePageProps = {
  isLoadingMembers: boolean;
  members: AuthMember[];
  membersError: string | null;
  onOpenChat?: () => void;
  onOpenMemberProfile?: (memberId: string) => void;
  onQueueChatMessage?: (message: string, attachments: ComposerAttachment[]) => void;
  onRefreshData?: () => void;
  refreshToken?: number;
  session: AuthSession;
};

type SummaryChip = {
  label: string | null;
  summary: string;
  tone: string;
  status: "good" | "warning" | "alert" | undefined;
};

type ReminderGroup = {
  iconBg: string;
  iconColor: string;
  key: "morning" | "afternoon" | "evening";
  label: string;
  materialIcon: string;
  reminders: DashboardReminder[];
};

// ─── icon_key → Material Symbol mapping ────────────────────────────────────────

const ICON_KEY_MAP: Record<string, string> = {
  medication: "medication",
  exercise: "fitness_center",
  checkup: "local_hospital",
  meal: "restaurant",
  rest: "bedtime",
  social: "groups",
  general: "auto_awesome",
};

function resolveReminderIcon(iconKey: string | null): string {
  if (iconKey && ICON_KEY_MAP[iconKey]) return ICON_KEY_MAP[iconKey];
  return "auto_awesome";
}

// ─── Status / chip helpers ─────────────────────────────────────────────────────

function dashboardChipTone(
  status: "good" | "warning" | "alert" | undefined,
  fallback: string,
) {
  if (status === "good") return "border-[#cde8c6] bg-[#edf6eb] text-[#3E5C3A]";
  if (status === "alert") return "border-[#F5D7D4] bg-[#FFF1F0] text-[#A54A45]";
  if (status === "warning")
    return "border-[#FAE6D8] bg-[#FEF5ED] text-[#A67C52]";
  return fallback;
}

function statusDot(status: "good" | "warning" | "alert" | undefined): string {
  if (status === "good") return "bg-emerald-400";
  if (status === "alert") return "bg-red-400";
  if (status === "warning") return "bg-amber-400";
  return "bg-gray-300";
}

function latestSummaryTime(
  summary: DashboardMemberSummary | undefined,
): string | null {
  if (!summary?.health_summaries?.length) return null;
  return (
    [...summary.health_summaries].sort((a, b) =>
      (b.generated_at ?? "").localeCompare(a.generated_at ?? ""),
    )[0]?.generated_at ?? null
  );
}

function formatRefreshTime(
  value: string | null,
  language: AppLanguage,
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const locale = language === "en" ? "en-US" : "zh-CN";
  if (diffMins < 1) return t("homeSummaryUpdatedJustNow");
  if (diffMins < 60)
    return t("homeSummaryUpdatedMinutesAgo", { count: diffMins });
  if (diffHours < 24)
    return t("homeSummaryUpdatedHoursAgo", { count: diffHours });
  const dateStr = date.toLocaleDateString(locale, {
    month: "numeric",
    day: "numeric",
  });
  return t("homeSummaryUpdatedOnDate", { date: dateStr });
}

function formatPanelRefreshTime(
  value: string | null | undefined,
  language: AppLanguage,
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const locale = language === "en" ? "en-US" : "zh-CN";
  const time = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return t("homePanelRefreshedAt", { time });
}

function buildSummaryChips(
  summary: DashboardMemberSummary | undefined,
  emptySummaryText: string,
): SummaryChip[] {
  return buildHealthSummaryCards(summary?.health_summaries, emptySummaryText).map(
    (item) => ({
      label: item.label,
      summary: item.content,
      tone: dashboardChipTone(
        item.status,
        "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
      ),
      status: item.status,
    }),
  );
}

// ─── Reminder grouping ─────────────────────────────────────────────────────────

function readHourFromIso(value: string | null) {
  if (!value) return 12;
  const match = value.match(/T(\d{2}):/);
  return match ? Number(match[1]) : 12;
}

function groupReminders(
  reminders: DashboardReminder[],
  groupLabels: { morning: string; afternoon: string; evening: string },
): ReminderGroup[] {
  const buckets: Record<ReminderGroup["key"], ReminderGroup> = {
    morning: {
      key: "morning",
      label: groupLabels.morning,
      reminders: [],
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      materialIcon: "wb_sunny",
    },
    afternoon: {
      key: "afternoon",
      label: groupLabels.afternoon,
      reminders: [],
      iconBg: "bg-sky-50",
      iconColor: "text-sky-500",
      materialIcon: "light_mode",
    },
    evening: {
      key: "evening",
      label: groupLabels.evening,
      reminders: [],
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
      materialIcon: "dark_mode",
    },
  };

  reminders.forEach((reminder) => {
    const slot = reminder.time_slot;
    if (slot === "清晨" || slot === "上午") {
      buckets.morning.reminders.push(reminder);
      return;
    }
    if (slot === "午后") {
      buckets.afternoon.reminders.push(reminder);
      return;
    }
    if (slot === "晚间" || slot === "睡前") {
      buckets.evening.reminders.push(reminder);
      return;
    }
    const hour = readHourFromIso(reminder.scheduled_at);
    if (hour < 12) {
      buckets.morning.reminders.push(reminder);
    } else if (hour < 18) {
      buckets.afternoon.reminders.push(reminder);
    } else {
      buckets.evening.reminders.push(reminder);
    }
  });

  return Object.values(buckets).filter((g) => g.reminders.length > 0);
}

function formatReminderTime(value: string | null, pendingLabel: string) {
  if (!value) return pendingLabel;
  const match = value.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

// ─── Permission label ──────────────────────────────────────────────────────────

function permissionLabel(
  member: AuthMember,
  session: AuthSession,
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
): { text: string; style: string } {
  if (
    member.user_account_id === session.user.id &&
    session.user.role === "admin"
  ) {
    return {
      text: t("appShellAdmin"),
      style: "bg-[#E8F0E6] text-[#2D4F3E] border-[#C6DBC2]",
    };
  }
  if (member.permission_level === "manage") {
    return {
      text: t("homePermissionManage"),
      style: "bg-[#EBF2F7] text-[#4A6076] border-[#C4D9E9]",
    };
  }
  if (member.permission_level === "write") {
    return {
      text: t("homePermissionWrite"),
      style: "bg-[#FEF5ED] text-[#A67C52] border-[#FAE6D8]",
    };
  }
  if (member.permission_level === "read") {
    return {
      text: t("homePermissionRead"),
      style: "bg-[#F8F6F3] text-warm-gray border-[#F2EDE7]",
    };
  }
  return {
    text: member.user_account_id
      ? t("homePermissionBound")
      : t("homePermissionIncomplete"),
    style: "bg-[#F8F6F3] text-warm-gray border-[#F2EDE7]",
  };
}

function canRefreshMemberSummary(member: AuthMember, session: AuthSession) {
  return (
    session.user.role === "admin" ||
    member.id === session.member.id ||
    member.permission_level === "write" ||
    member.permission_level === "manage"
  );
}

function buildRefreshError(
  result: DailyGenerationRefreshResponse,
  fallbackMessage: string,
) {
  if (result.member_ids.length > 0) {
    return null;
  }

  const firstError = Object.values(result.errors)[0];
  return firstError || fallbackMessage;
}

// ─── Main component ────────────────────────────────────────────────────────────

import { ChatInput } from "../components/ChatInput";

/** Space below scrollable panels so content clears the fixed bottom composer (gradient + ChatInput, incl. multi-line). */
const HOME_SCROLL_BOTTOM_PAD =
  "pb-[calc(16rem+env(safe-area-inset-bottom,0px))]";

export function HomePage({
  isLoadingMembers,
  members,
  membersError,
  onOpenChat,
  onOpenMemberProfile,
  onQueueChatMessage,
  onRefreshData,
  refreshToken = 0,
  session,
}: HomePageProps) {
  const { t, language } = usePreferences();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isRefreshingCarePlans, setIsRefreshingCarePlans] = useState(false);
  const [refreshingMemberId, setRefreshingMemberId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const {
    attachments: composerAttachments,
    clearAttachments: clearComposerAttachments,
    hasActiveUploads: isUploadingComposerAttachment,
    removeAttachment: removeComposerAttachment,
    uploadAttachment: uploadComposerAttachment,
  } = useComposerAttachments({
    session,
    onSuggestedText: (value) => {
      setComposerValue((current) => (current ? `${current}\n${value}` : value));
    },
    onError: (message) => {
      setDashboardError(message);
    },
  });

  const visibleMembers = members.length > 0 ? members : [session.member];
  const memberSummaries = new Map(
    (dashboard?.members ?? []).map((item) => [item.member.id, item]),
  );
  const reminderGroups = groupReminders(
    dashboard?.today_reminders ?? [],
    {
      morning: t("homeReminderGroupMorning"),
      afternoon: t("homeReminderGroupAfternoon"),
      evening: t("homeReminderGroupEvening"),
    },
  );
  const totalReminders = dashboard?.today_reminders?.length ?? 0;
  const reminderRefreshText = formatPanelRefreshTime(
    dashboard?.today_reminders_refreshed_at,
    language,
    t,
  );
  const canRefreshAnyCarePlan = visibleMembers.some((member) =>
    canRefreshMemberSummary(member, session),
  );

  async function loadDashboardData() {
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const nextDashboard = await getDashboard(session);
      setDashboard(nextDashboard);
    } catch (error) {
      setDashboard(null);
      setDashboardError(
        error instanceof Error
          ? error.message
          : t("homeDashboardLoadError"),
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  useEffect(() => {
    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, session]);

  async function syncAfterManualRefresh() {
    if (onRefreshData) {
      onRefreshData();
      return;
    }
    await loadDashboardData();
  }

  function handleOpenChat() {
    onOpenChat?.();
  }

  function handleSendHomeMessage() {
    const trimmed = composerValue.trim();
    const readyComposerAttachments = readyAttachmentContexts(composerAttachments);
    const content = trimmed || (
      readyComposerAttachments.length > 0
        ? t("homeAttachmentAnalysisPrompt", {
            count: readyComposerAttachments.length,
          })
        : ""
    );
    if (!content) {
      onOpenChat?.();
      return;
    }
    onQueueChatMessage?.(content, composerAttachments);
    setComposerValue("");
    clearComposerAttachments();
  }

  async function handleComposerAttachmentUpload(file: File) {
    setDashboardError(null);
    await uploadComposerAttachment(file);
  }

  function handleRemoveComposerAttachment(attachmentId: string) {
    removeComposerAttachment(attachmentId);
  }

  async function handleRefreshMemberSummary(member: AuthMember) {
    setRefreshingMemberId(member.id);
    setDashboardError(null);
    try {
      const result = await refreshMemberHealthSummaries(session, member.id, language);
      const errorMessage = buildRefreshError(
        result,
        t("homeAiSummaryRefreshError"),
      );
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      await syncAfterManualRefresh();
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : t("homeAiSummaryRefreshError"),
      );
    } finally {
      setRefreshingMemberId(null);
    }
  }

  async function handleRefreshCarePlans() {
    setIsRefreshingCarePlans(true);
    setDashboardError(null);
    try {
      const result = await refreshDashboardTodayReminders(session, language);
      const errorMessage = buildRefreshError(
        result,
        t("homeRemindersRefreshError"),
      );
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      await syncAfterManualRefresh();
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : t("homeRemindersRefreshError"),
      );
    } finally {
      setIsRefreshingCarePlans(false);
    }
  }

  return (
    <section className="flex flex-1 flex-col h-full overflow-hidden">
      {/* ── Two-panel layout ─────────────────────────────────────────── */}
      <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
        {/* ── Left: 家人状态 ──────────────────────────────────────────── */}
        <aside className="flex h-full w-[22rem] shrink-0 flex-col gap-4">
          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2D2926]">
              <MaterialIcon className="text-xl text-rose-400" name="group" />
              {t("homeFamilyStatus")}
            </h2>
            <span className="rounded-full border border-[#F2EDE7] bg-white px-3 py-1 text-xs font-semibold text-warm-gray shadow-soft">
              {t("homeMemberCountBadge", { count: visibleMembers.length })}
            </span>
          </div>

          {/* Error */}
          {membersError ? (
            <div className="shrink-0 rounded-2xl border border-[#f1d6d6] bg-[#fff5f4] px-4 py-3 text-sm text-[#9a5e5e]">
              {membersError}
            </div>
          ) : null}

          {/* Loading skeleton */}
          {isLoadingMembers && members.length === 0 ? (
            <div className="shrink-0 rounded-2xl border border-[#F2EDE7]/60 bg-white px-4 py-3 text-sm text-warm-gray">
              {t("homeLoadingMembers")}
            </div>
          ) : null}

          {/* Member cards — scrollable */}
          <div
            className={`flex-1 min-h-0 space-y-4 overflow-y-auto no-scrollbar ${HOME_SCROLL_BOTTOM_PAD}`}
          >
            {visibleMembers.map((member) => {
              const summaryData = memberSummaries.get(member.id);
              const chips = buildSummaryChips(
                summaryData,
                t("homeHealthSummaryAwaiting"),
              );
              const avatarBg = getAvatarColor(member.name);
              const perm = permissionLabel(member, session, t);
              const refreshedAt = latestSummaryTime(summaryData);

              return (
                <article
                  className="relative rounded-[2rem] border border-[#F2EDE7]/60 bg-white p-5 shadow-card"
                  key={member.id}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                      style={{ backgroundColor: avatarBg }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#2D2926] truncate">
                          {member.name}
                        </p>
                        <span
                          className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${perm.style}`}
                        >
                          {perm.text}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-warm-gray">
                        {refreshedAt
                          ? formatRefreshTime(refreshedAt, language, t)
                          : t("homeNoSummaryYet")}
                      </p>
                    </div>
                  </div>

                  {/* Summary chips */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {chips.map((chip, idx) => (
                      <div
                        className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${chip.tone}`}
                        key={`${member.id}-chip-${idx}`}
                      >
                        <span
                          className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${statusDot(chip.status)}`}
                        />
                        <div className="min-w-0">
                          {chip.label ? (
                            <p className="font-semibold uppercase tracking-[0.18em] text-current/60 truncate">
                              {chip.label}
                            </p>
                          ) : null}
                          <p
                            className={`${chip.label ? "mt-1 " : ""}font-bold text-current leading-snug`}
                          >
                            {chip.summary}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer row */}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button
                      aria-label={t("homeViewProfileAria", { name: member.name })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F0EA] px-4 py-2 text-sm font-semibold text-[#2D2926] transition hover:bg-[#efe7de]"
                      onClick={() => onOpenMemberProfile?.(member.id)}
                      type="button"
                    >
                      <MaterialIcon className="text-base" name="person" />
                      {t("homeViewProfile")}
                    </button>
                    <button
                      aria-label={t("homeRefreshMemberAria", { name: member.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-warm-gray transition hover:bg-[#F5F0EA] hover:text-[#4A443F]"
                      disabled={
                        refreshingMemberId === member.id ||
                        !canRefreshMemberSummary(member, session)
                      }
                      onClick={() => void handleRefreshMemberSummary(member)}
                      type="button"
                    >
                      <MaterialIcon
                        className={`text-base ${refreshingMemberId === member.id ? "animate-spin" : ""}`}
                        name="refresh"
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>

        {/* ── Right: 今日提醒 ─────────────────────────────────────────── */}
        <div className="flex h-full min-w-0 flex-1 flex-col gap-4">
          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#2D2926] flex items-center gap-2">
                <MaterialIcon
                  className="text-xl text-amber-400"
                  name="event_note"
                />
                {t("homeTodayReminders")}
              </h2>
              <p className="mt-0.5 text-xs text-warm-gray">
                {totalReminders > 0
                  ? t("homeReminderTasksLine", {
                      total: totalReminders,
                      slots: reminderGroups.length,
                    })
                  : t("homeNoRemindersSubtitle")}
                {reminderRefreshText
                  ? `　·　${reminderRefreshText}`
                  : ""}
              </p>
            </div>
            <button
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#4A443F] shadow-soft transition hover:shadow-md"
              disabled={isRefreshingCarePlans || !canRefreshAnyCarePlan}
              onClick={() => void handleRefreshCarePlans()}
              type="button"
            >
              <MaterialIcon
                className={`text-sm ${(isRefreshingCarePlans || isLoadingDashboard) ? "animate-spin" : ""}`}
                name="event_repeat"
              />
              {isRefreshingCarePlans ? t("homeRefreshing") : t("homeRefresh")}
            </button>
          </div>

          {/* Error */}
          {dashboardError ? (
            <div className="shrink-0 rounded-2xl border border-[#f1d6d6] bg-[#fff5f4] px-5 py-3 text-sm text-[#9a5e5e]">
              {dashboardError}
            </div>
          ) : null}

          {/* Loading */}
          {isLoadingDashboard && !dashboard ? (
            <div className="shrink-0 rounded-[2rem] border border-[#F2EDE7]/60 bg-white px-6 py-6 text-sm text-warm-gray shadow-card">
              {t("homeLoadingReminders")}
            </div>
          ) : null}

          {/* Empty state */}
          {reminderGroups.length === 0 && !isLoadingDashboard ? (
            <div className="rounded-[2rem] border border-[#F2EDE7]/60 bg-white px-8 py-10 shadow-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-400">
                <MaterialIcon className="text-3xl" name="event_available" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-[#2D2926]">
                {t("homeEmptyRemindersTitle")}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-warm-gray">
                {t("homeEmptyRemindersBody")}
              </p>
            </div>
          ) : null}

          {/* Reminder groups — scrollable */}
          <div
            className={`flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-6 pr-2 ${HOME_SCROLL_BOTTOM_PAD}`}
          >
            {reminderGroups.map((group) => (
              <section className="space-y-3" key={group.key}>
                {/* Group header */}
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${group.iconBg} ${group.iconColor}`}
                  >
                    <MaterialIcon className="text-lg" name={group.materialIcon} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#2D2926]">
                      {group.label}
                    </h3>
                    <p className="text-[11px] text-warm-gray">
                      {t("homeReminderCountInGroup", {
                        count: group.reminders.length,
                      })}
                    </p>
                  </div>
                </div>

                {/* Cards grid — 小屏单列，md+ 双列（对齐 stitch 参考） */}
                <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 md:gap-4">
                  {group.reminders.map((reminder) => {
                    const reminderIcon = resolveReminderIcon(
                      reminder.icon_key ?? null,
                    );
                    const assigneeBg = getAvatarColor(reminder.member_name);

                    return (
                      <article
                        className="flex w-full flex-col rounded-2xl border border-[#F2EDE7]/40 bg-white px-4 py-3 shadow-card"
                        key={reminder.id}
                      >
                        {/* Top: task icon + 成员头像（点击进档案） */}
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${group.iconBg} ${group.iconColor}`}
                          >
                            <MaterialIcon
                              className="text-xl"
                              name={reminderIcon}
                            />
                          </div>
                          <button
                            aria-label={t("homeViewReminderMemberAria", {
                              name: reminder.member_name,
                            })}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-[#F9F7F4] transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/50 focus-visible:ring-offset-2"
                            onClick={() =>
                              onOpenMemberProfile?.(reminder.member_id)
                            }
                            style={{ backgroundColor: assigneeBg }}
                            title={reminder.member_name}
                            type="button"
                          >
                            {reminder.member_name.charAt(0)}
                          </button>
                        </div>

                        {/* Content */}
                        <div className="mt-2.5 min-w-0">
                          <p className="text-[11px] font-semibold text-warm-gray">
                            {t("homeReminderForMember", {
                              name: reminder.member_name,
                            })}
                          </p>
                          <h4 className="mt-1 text-base font-bold leading-snug text-[#2D2926]">
                            {reminder.title}
                          </h4>
                          {reminder.description ? (
                            <p className="mt-1 text-xs leading-snug text-warm-gray line-clamp-2">
                              {reminder.description}
                            </p>
                          ) : null}
                          {reminder.notes ? (
                            <p className="mt-1 text-[11px] leading-snug text-warm-gray/80 italic line-clamp-2">
                              {reminder.notes}
                            </p>
                          ) : null}
                        </div>

                        {/* Time */}
                        <div className="mt-3 flex items-center">
                          <span className="rounded-full bg-[#F5F0EA] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-warm-gray">
                            {formatReminderTime(
                              reminder.scheduled_at,
                              t("homeReminderPendingSchedule"),
                            )}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fixed bottom composer bar ─────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-warm-cream via-warm-cream/80 to-transparent px-5 py-5 sm:px-6 sm:py-7">
        <div className="pointer-events-auto w-full">
          <ChatInput
            allowEmptySubmit
            attachments={composerAttachments}
            draft={composerValue}
            isBusy={isLoadingDashboard}
            isUploading={isUploadingComposerAttachment}
            memberOptions={visibleMembers.map(m => ({ id: m.id, name: m.name }))}
            onAttachmentRemove={handleRemoveComposerAttachment}
            onAttachmentUpload={handleComposerAttachmentUpload}
            onDraftChange={setComposerValue}
            onMemberChange={setSelectedMemberId}
            onSend={handleSendHomeMessage}
            selectedMemberId={selectedMemberId}
            placeholder={t("homeComposerPlaceholder")}
          />
        </div>
      </div>
    </section>
  );
}
