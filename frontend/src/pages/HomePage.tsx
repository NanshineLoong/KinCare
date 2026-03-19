import { useEffect, useState } from "react";

import {
  getDashboard,
  type DashboardMemberSummary,
  type DashboardReminder,
  type DashboardResponse,
} from "../api/health";
import { transcribeAudio } from "../api/chat";
import type { AuthMember, AuthSession } from "../auth/session";
import { usePreferences } from "../preferences";

// ─── Tiny helpers ──────────────────────────────────────────────────────────────

function MaterialIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={`material-symbols-outlined ${className ?? ""}`}>
      {name}
    </span>
  );
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
  onQueueChatMessage?: (message: string) => void;
  onAudioUpload?: (file: File) => void;
  refreshToken?: number;
  session: AuthSession;
};

type SummaryChip = {
  label: string;
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

function healthSummaryItem(
  summary: DashboardMemberSummary | undefined,
  category: string,
) {
  return summary?.health_summaries?.find((item) => item.category === category);
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

function formatRefreshTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return "刚刚更新";
  if (diffMins < 60) return `${diffMins} 分钟前更新`;
  if (diffHours < 24) return `${diffHours} 小时前更新`;
  return (
    date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) +
    " 更新"
  );
}

function buildSummaryChips(
  summary: DashboardMemberSummary | undefined,
): SummaryChip[] {
  const fallback = (label: string): SummaryChip => ({
    label,
    summary: "期待新记录",
    tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
    status: undefined,
  });

  const categories: { cat: string; fallbackLabel: string }[] = [
    { cat: "chronic-vitals", fallbackLabel: "慢病管理" },
    { cat: "lifestyle", fallbackLabel: "生活习惯" },
    { cat: "body-vitals", fallbackLabel: "生理指标" },
  ];

  const chips: SummaryChip[] = categories.map(({ cat, fallbackLabel }) => {
    const item = healthSummaryItem(summary, cat);
    if (!item) return fallback(fallbackLabel);
    return {
      label: item.label,
      summary: item.value,
      tone: dashboardChipTone(
        item.status,
        "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
      ),
      status: item.status,
    };
  });

  // 4th chip: mood or overall status
  const moodItem =
    healthSummaryItem(summary, "mood") ?? summary?.health_summaries?.[3];
  if (moodItem) {
    chips.push({
      label: moodItem.label,
      summary: moodItem.value,
      tone: dashboardChipTone(
        moodItem.status,
        "border-[#FAE6D8] bg-[#FEF5ED] text-[#A67C52]",
      ),
      status: moodItem.status,
    });
  } else {
    const count = summary?.health_summaries?.length ?? 0;
    chips.push(
      count > 0
        ? {
          label: "摘要状态",
          summary: `已生成 ${count} 条摘要`,
          tone: "border-[#FAE6D8] bg-[#FEF5ED] text-[#A67C52]",
          status: undefined,
        }
        : fallback("摘要状态"),
    );
  }

  return chips;
}

// ─── Reminder grouping ─────────────────────────────────────────────────────────

function readHourFromIso(value: string | null) {
  if (!value) return 12;
  const match = value.match(/T(\d{2}):/);
  return match ? Number(match[1]) : 12;
}

function groupReminders(reminders: DashboardReminder[]): ReminderGroup[] {
  const buckets: Record<ReminderGroup["key"], ReminderGroup> = {
    morning: {
      key: "morning",
      label: "清晨的叮嘱",
      reminders: [],
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      materialIcon: "wb_sunny",
    },
    afternoon: {
      key: "afternoon",
      label: "午后的守候",
      reminders: [],
      iconBg: "bg-sky-50",
      iconColor: "text-sky-500",
      materialIcon: "light_mode",
    },
    evening: {
      key: "evening",
      label: "晚间小结",
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

function formatReminderTime(value: string | null) {
  if (!value) return "待安排";
  const match = value.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

// ─── Permission label ──────────────────────────────────────────────────────────

function permissionLabel(
  member: AuthMember,
  session: AuthSession,
): { text: string; style: string } {
  if (
    member.user_account_id === session.user.id &&
    session.user.role === "admin"
  ) {
    return {
      text: "管理员",
      style: "bg-[#E8F0E6] text-[#2D4F3E] border-[#C6DBC2]",
    };
  }
  if (member.permission_level === "manage") {
    return {
      text: "可管理",
      style: "bg-[#EBF2F7] text-[#4A6076] border-[#C4D9E9]",
    };
  }
  if (member.permission_level === "write") {
    return {
      text: "可写入",
      style: "bg-[#FEF5ED] text-[#A67C52] border-[#FAE6D8]",
    };
  }
  if (member.permission_level === "read") {
    return {
      text: "可读取",
      style: "bg-[#F8F6F3] text-warm-gray border-[#F2EDE7]",
    };
  }
  return {
    text: member.user_account_id ? "已绑定" : "待完善",
    style: "bg-[#F8F6F3] text-warm-gray border-[#F2EDE7]",
  };
}

// ─── Main component ────────────────────────────────────────────────────────────

import { ChatInput } from "../components/ChatInput";

export function HomePage({
  isLoadingMembers,
  members,
  membersError,
  onOpenChat,
  onOpenMemberProfile,
  onQueueChatMessage,
  onAudioUpload,
  refreshToken = 0,
  session,
}: HomePageProps) {
  const { t } = usePreferences();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isTranscribingComposer, setIsTranscribingComposer] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const visibleMembers = members.length > 0 ? members : [session.member];
  const memberSummaries = new Map(
    (dashboard?.members ?? []).map((item) => [item.member.id, item]),
  );
  const reminderGroups = groupReminders(dashboard?.today_reminders ?? []);
  const totalReminders = dashboard?.today_reminders?.length ?? 0;

  async function loadDashboardData() {
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const nextDashboard = await getDashboard(session);
      setDashboard(nextDashboard);
      setLastRefreshTime(new Date());
    } catch (error) {
      setDashboard(null);
      setDashboardError(
        error instanceof Error
          ? error.message
          : "首页聚合数据加载失败，请重试。",
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  useEffect(() => {
    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, session]);

  function handleOpenChat() {
    onOpenChat?.();
  }

  function handleSendHomeMessage() {
    const trimmed = composerValue.trim();
    if (!trimmed) {
      onOpenChat?.();
      return;
    }
    onQueueChatMessage?.(trimmed);
    setComposerValue("");
  }

  async function handleComposerAudioUpload(file: File) {
    setIsTranscribingComposer(true);
    try {
      const result = await transcribeAudio(session, file);
      setComposerValue((current) =>
        current ? `${current}\n${result.text}` : result.text,
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "语音识别失败，请稍后重试。",
      );
    } finally {
      setIsTranscribingComposer(false);
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
              {visibleMembers.length} 位成员
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
              正在加载家庭成员…
            </div>
          ) : null}

          {/* Member cards — scrollable */}
          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto no-scrollbar pb-24">
            {visibleMembers.map((member) => {
              const summaryData = memberSummaries.get(member.id);
              const chips = buildSummaryChips(summaryData);
              const avatarBg = getAvatarColor(member.name);
              const perm = permissionLabel(member, session);
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
                          ? formatRefreshTime(refreshedAt)
                          : "暂无健康摘要"}
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
                          <p className="font-semibold uppercase tracking-[0.18em] text-current/60 truncate">
                            {chip.label}
                          </p>
                          <p className="mt-1 font-bold text-current leading-snug">
                            {chip.summary}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer row */}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button
                      aria-label={`查看 ${member.name} 档案`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F0EA] px-4 py-2 text-sm font-semibold text-[#2D2926] transition hover:bg-[#efe7de]"
                      onClick={() => onOpenMemberProfile?.(member.id)}
                      type="button"
                    >
                      <MaterialIcon className="text-base" name="person" />
                      查看档案
                    </button>
                    <button
                      aria-label={`刷新 ${member.name} 的数据`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-warm-gray transition hover:bg-[#F5F0EA] hover:text-[#4A443F]"
                      onClick={() => void loadDashboardData()}
                      type="button"
                    >
                      <MaterialIcon className="text-base" name="refresh" />
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
                  ? `共 ${totalReminders} 项健康任务，覆盖 ${reminderGroups.length} 个时段`
                  : "暂无今日提醒"}
                {lastRefreshTime
                  ? `　·　${lastRefreshTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 已刷新`
                  : ""}
              </p>
            </div>
            <button
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#4A443F] shadow-soft transition hover:shadow-md"
              onClick={() => void loadDashboardData()}
              type="button"
            >
              <MaterialIcon
                className={`text-sm ${isLoadingDashboard ? "animate-spin" : ""}`}
                name="event_repeat"
              />
              {isLoadingDashboard ? t("homeRefreshing") : t("homeRefresh")}
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
              正在整理今日提醒…
            </div>
          ) : null}

          {/* Empty state */}
          {reminderGroups.length === 0 && !isLoadingDashboard ? (
            <div className="rounded-[2rem] border border-[#F2EDE7]/60 bg-white px-8 py-10 shadow-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-400">
                <MaterialIcon className="text-3xl" name="event_available" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-[#2D2926]">
                今天还没有待办提醒
              </h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-warm-gray">
                可以先进入成员档案补充用药、复诊和指标记录，系统会在每日刷新时同步最新
                AI 提醒。
              </p>
            </div>
          ) : null}

          {/* Reminder groups — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-8 pb-24 pr-2">
            {reminderGroups.map((group) => (
              <section className="space-y-4" key={group.key}>
                {/* Group header */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${group.iconBg} ${group.iconColor}`}
                  >
                    <MaterialIcon
                      className="text-xl"
                      name={group.materialIcon}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#2D2926]">
                      {group.label}
                    </h3>
                    <p className="text-xs text-warm-gray">
                      {group.reminders.length} 项提醒
                    </p>
                  </div>
                </div>

                {/* Cards grid */}
                <div
                  className={`grid gap-4 ${group.reminders.length > 1 ? "xl:grid-cols-2" : ""
                    }`}
                >
                  {group.reminders.map((reminder) => {
                    const reminderIcon = resolveReminderIcon(
                      reminder.icon_key ?? null,
                    );
                    const assigneeBg = getAvatarColor(reminder.member_name);

                    return (
                      <article
                        className="flex h-full flex-col justify-between rounded-[2rem] border border-[#F2EDE7]/40 bg-white px-6 py-5 shadow-card"
                        key={reminder.id}
                      >
                        {/* Top: icon + assignee avatar */}
                        <div className="flex items-start justify-between gap-4">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] ${group.iconBg} ${group.iconColor}`}
                          >
                            <MaterialIcon
                              className="text-2xl"
                              name={reminderIcon}
                            />
                          </div>
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                            style={{ backgroundColor: assigneeBg }}
                            title={reminder.member_name}
                          >
                            {reminder.member_name.charAt(0)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-warm-gray">
                            给 {reminder.member_name}
                          </p>
                          <h4 className="mt-1.5 text-xl font-bold leading-snug text-[#2D2926]">
                            {reminder.title}
                          </h4>
                          {reminder.description ? (
                            <p className="mt-2 text-sm leading-relaxed text-warm-gray line-clamp-2">
                              {reminder.description}
                            </p>
                          ) : null}
                          {reminder.notes ? (
                            <p className="mt-1.5 text-xs leading-relaxed text-warm-gray/80 italic line-clamp-2">
                              {reminder.notes}
                            </p>
                          ) : null}
                        </div>

                        {/* Footer */}
                        <div className="mt-5 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-[#F5F0EA] px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-warm-gray">
                            {formatReminderTime(reminder.scheduled_at)}
                          </span>
                          <button
                            className="text-sm font-semibold text-apple-blue transition hover:text-[#005fcc]"
                            onClick={() =>
                              onOpenMemberProfile?.(reminder.member_id)
                            }
                            type="button"
                          >
                            去档案页
                          </button>
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
            draft={composerValue}
            isBusy={isLoadingDashboard || isTranscribingComposer}
            memberOptions={visibleMembers.map(m => ({ id: m.id, name: m.name }))}
            onDraftChange={setComposerValue}
            onMemberChange={setSelectedMemberId}
            onSend={handleSendHomeMessage}
            onAudioUpload={handleComposerAudioUpload}
            selectedMemberId={selectedMemberId}
            placeholder={t("homeComposerPlaceholder")}
          />
        </div>
      </div>
    </section>
  );
}
