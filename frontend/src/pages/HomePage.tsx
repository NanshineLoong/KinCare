import { useEffect, useState } from "react";

import { getDashboard, type DashboardMemberSummary, type DashboardReminder, type DashboardResponse } from "../api/health";
import type { AuthMember, AuthSession } from "../auth/session";


function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className ?? ""}`}>{name}</span>;
}

type HomePageProps = {
  isLoadingMembers: boolean;
  members: AuthMember[];
  membersError: string | null;
  onOpenChat?: () => void;
  onOpenMemberProfile?: (memberId: string) => void;
  onQueueChatMessage?: (message: string) => void;
  refreshToken?: number;
  session: AuthSession;
};

type SummaryChip = {
  label: string;
  summary: string;
  tone: string;
};

type ReminderGroup = {
  iconBg: string;
  iconColor: string;
  key: "morning" | "afternoon" | "evening";
  label: string;
  materialIcon: string;
  reminders: DashboardReminder[];
};

function dashboardChipTone(status: "good" | "warning" | "neutral" | undefined, fallback: string) {
  if (status === "good") {
    return "border-[#E8F0E6] bg-soft-sage text-[#3E5C3A]";
  }
  if (status === "warning") {
    return "border-[#FAE6D8] bg-[#FEF5ED] text-[#A67C52]";
  }
  return fallback;
}

function healthSummary(summary: DashboardMemberSummary | undefined, category: string) {
  return summary?.health_summaries?.find((item) => item.category === category);
}

function readHourFromIso(value: string | null) {
  if (!value) {
    return 12;
  }
  const match = value.match(/T(\d{2}):/);
  return match ? Number(match[1]) : 12;
}

function summarizeCondition(summary: DashboardMemberSummary | undefined): SummaryChip {
  const chronicSummary = healthSummary(summary, "chronic-vitals");
  if (chronicSummary) {
    return {
      label: "慢病管理",
      summary: chronicSummary.value,
      tone: dashboardChipTone(chronicSummary.status, "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray"),
    };
  }

  return {
    label: "慢病管理",
    summary: "期待新记录",
    tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
  };
}

function summarizeLifestyle(summary: DashboardMemberSummary | undefined): SummaryChip {
  const lifestyleSummary = healthSummary(summary, "lifestyle");
  if (lifestyleSummary) {
    return {
      label: "生活习惯",
      summary: lifestyleSummary.value,
      tone: dashboardChipTone(lifestyleSummary.status, "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray"),
    };
  }

  return {
    label: "生活习惯",
    summary: "等待活动记录",
    tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
  };
}

function summarizeVitals(summary: DashboardMemberSummary | undefined): SummaryChip {
  const bodySummary = healthSummary(summary, "body-vitals");
  if (bodySummary) {
    return {
      label: "生理指标",
      summary: bodySummary.value,
      tone: dashboardChipTone(bodySummary.status, "border-[#DAE8F7] bg-gentle-blue text-[#41678B]"),
    };
  }

  return {
    label: "生理指标",
    summary: "期待新记录",
    tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
  };
}

function summarizeMood(summary: DashboardMemberSummary | undefined): SummaryChip {
  const itemCount = summary?.health_summaries?.length ?? 0;
  if (itemCount > 0) {
    return {
      label: "摘要状态",
      summary: `已生成 ${itemCount} 条摘要`,
      tone: "border-[#FAE6D8] bg-[#FEF5ED] text-[#A67C52]",
    };
  }

  return {
    label: "摘要状态",
    summary: "等待摘要生成",
    tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
  };
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
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      materialIcon: "light_mode",
    },
    evening: {
      key: "evening",
      label: "晚间小结",
      reminders: [],
      iconBg: "bg-purple-50",
      iconColor: "text-purple-500",
      materialIcon: "dark_mode",
    },
  };

  reminders.forEach((reminder) => {
    const hour = readHourFromIso(reminder.scheduled_at);
    if (hour < 12) {
      buckets.morning.reminders.push(reminder);
    } else if (hour < 18) {
      buckets.afternoon.reminders.push(reminder);
    } else {
      buckets.evening.reminders.push(reminder);
    }
  });

  return Object.values(buckets).filter((group) => group.reminders.length > 0);
}

function formatReminderTime(value: string | null) {
  if (!value) {
    return "待安排";
  }

  const match = value.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

export function HomePage({
  isLoadingMembers,
  members,
  membersError,
  onOpenChat,
  onOpenMemberProfile,
  onQueueChatMessage,
  refreshToken = 0,
  session,
}: HomePageProps) {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const visibleMembers = members.length > 0 ? members : [session.member];
  const memberSummaries = new Map((dashboard?.members ?? []).map((item) => [item.member.id, item]));
  const reminderGroups = groupReminders(dashboard?.today_reminders ?? []);

  async function loadDashboardData() {
    setIsLoadingDashboard(true);
    setDashboardError(null);

    try {
      const nextDashboard = await getDashboard(session);
      setDashboard(nextDashboard);
    } catch (error) {
      setDashboard(null);
      setDashboardError(error instanceof Error ? error.message : "首页聚合数据加载失败，请重试。");
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  useEffect(() => {
    void loadDashboardData();
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

  const totalReminders = dashboard?.today_reminders?.length ?? 0;

  return (
    <section className="flex flex-1 flex-col gap-6 pb-28 xl:gap-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#2D2926]">今日贴心提醒</h2>
          <p className="mt-1 text-warm-gray">今天有 {totalReminders} 项健康小任务等待完成，一起加油吧！</p>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-apple-blue shadow-soft"
          onClick={() => void loadDashboardData()}
          type="button"
        >
          <MaterialIcon className="text-sm" name="event_repeat" />
          刷新进度
        </button>
      </div>

      <div className="flex h-[calc(100vh-5rem-120px)] gap-8 overflow-hidden">
        <aside className="flex h-full w-80 flex-col gap-5">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#2D2926]">
              <MaterialIcon className="text-rose-400 text-xl" name="group" />
              家人状态
            </h3>
            <span className="rounded-full border border-[#F2EDE7] bg-white px-3 py-1 text-xs font-semibold text-warm-gray shadow-soft">
              {visibleMembers.length} 位成员
            </span>
          </div>

          {membersError ? (
            <div className="shrink-0 rounded-[1.6rem] border border-[#f1d6d6] bg-[#fff5f4] px-4 py-4 text-sm text-[#9a5e5e]">
              {membersError}
            </div>
          ) : null}

          {isLoadingMembers && members.length === 0 ? (
            <div className="rounded-[1.6rem] border border-[#F2EDE7]/60 bg-white px-4 py-4 text-sm text-warm-gray shrink-0">
              正在加载家庭成员...
            </div>
          ) : null}

          <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
            {visibleMembers.map((member) => {
              const summary = memberSummaries.get(member.id);
              const chips = [
                summarizeCondition(summary),
                summarizeLifestyle(summary),
                summarizeVitals(summary),
                summarizeMood(summary),
              ];

              return (
                <article className="relative rounded-[2rem] border border-[#F2EDE7]/60 bg-white p-5 shadow-card" key={member.id}>
                  <button
                    aria-label="更多操作"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-all hover:bg-gray-100 hover:text-apple-blue"
                    type="button"
                  >
                    <MaterialIcon className="text-lg" name="more_horiz" />
                  </button>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F9EBEA] text-lg font-bold text-[#b86d6d]">
                        {member.name.slice(0, 1)}
                      </div>
                      <div>
                        <p className="font-bold text-[#2D2926]">{member.name}</p>
                        <p className="text-xs text-[#4f8a62]">
                          {member.id === session.member.id
                            ? session.user.role === "admin"
                              ? "当前管理员"
                              : "当前成员"
                            : member.user_account_id
                              ? "已绑定账号"
                              : "待完善档案"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {chips.map((chip) => (
                      <div className={`rounded-2xl border px-3 py-3 text-xs ${chip.tone}`} key={chip.label}>
                        <p className="font-semibold uppercase tracking-[0.2em] text-current/70">{chip.label}</p>
                        <p className="mt-2 text-sm font-bold text-current">{chip.summary}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-[#F5F0EA] px-4 py-2 text-sm font-semibold text-[#2D2926] transition hover:bg-[#efe7de]"
                      onClick={() => onOpenMemberProfile?.(member.id)}
                      type="button"
                    >
                      查看 {member.name} 档案
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>

        <div className="flex min-w-0 h-full flex-1 flex-col">
          {dashboardError ? (
            <div className="shrink-0 rounded-[2rem] border border-[#f1d6d6] bg-[#fff5f4] px-5 py-4 text-sm text-[#9a5e5e]">
              {dashboardError}
            </div>
          ) : null}

          {isLoadingDashboard ? (
            <div className="shrink-0 rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-8 text-sm text-warm-gray shadow-card">
              正在整理今日提醒...
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-10 pb-20 pr-4">
            {reminderGroups.length === 0 && !isLoadingDashboard ? (
              <div className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-8 py-10 shadow-card">
                <h3 className="text-2xl font-bold text-[#2D2926]">今天还没有待办提醒</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-warm-gray">
                  可以先进入成员档案补充用药、复诊和指标记录，系统会在后续 AI 阶段生成更完整的每日提醒。
                </p>
              </div>
            ) : null}

            {reminderGroups.map((group) => (
              <section className="space-y-5" key={group.key}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${group.iconBg} ${group.iconColor}`}>
                    <MaterialIcon className="text-xl" name={group.materialIcon} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-[#2D2926]">{group.label}</h3>
                    <p className="text-sm text-warm-gray">今天有 {group.reminders.length} 项提醒需要留意</p>
                  </div>
                </div>

                <div className={`grid gap-5 ${group.reminders.length > 1 ? "xl:grid-cols-2" : ""}`}>
                  {group.reminders.map((reminder) => (
                    <article
                      className="flex h-full flex-col justify-between rounded-[2.5rem] border border-[#F2EDE7]/40 bg-white px-6 py-6 shadow-card"
                      key={reminder.id}
                    >
                      <div className="flex items-start justify-between gap-5">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.5rem] ${group.iconBg} ${group.iconColor}`}>
                          <MaterialIcon className="text-2xl" name="auto_awesome" />
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EEE7] text-lg font-bold text-[#8c7c73]">
                          {reminder.member_name.slice(0, 1)}
                        </div>
                      </div>

                      <div className="mt-6">
                        <p className="text-sm font-semibold text-warm-gray">给 {reminder.member_name}</p>
                        <h4 className="mt-2 text-2xl font-bold leading-tight text-[#2D2926]">{reminder.title}</h4>
                        <p className="mt-3 text-sm leading-7 text-warm-gray">{reminder.description}</p>
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-[#F5F0EA] px-4 py-2 text-xs font-semibold tracking-[0.22em] text-warm-gray">
                          {formatReminderTime(reminder.scheduled_at)}
                        </span>
                        <button
                          className="text-sm font-semibold text-apple-blue transition hover:text-[#005fcc]"
                          onClick={() => onOpenMemberProfile?.(reminder.member_id)}
                          type="button"
                        >
                          去档案页
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-warm-cream via-warm-cream to-transparent px-5 py-5 sm:px-6 sm:py-8">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-[2.5rem] border border-white/80 bg-white px-3 py-3 shadow-card">
          <button
            aria-label="打开 AI 对话"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full text-warm-gray transition hover:bg-[#F7F3EE] hover:text-apple-blue"
            onClick={handleOpenChat}
            type="button"
          >
            <MaterialIcon className="text-2xl" name="add" />
          </button>
          <input
            className="h-12 min-w-0 flex-1 rounded-full border-none bg-transparent px-2 text-base text-[#2D2926] outline-none placeholder:text-[#B8B0A9]"
            onChange={(event) => setComposerValue(event.target.value)}
            placeholder="说说今天家人的健康情况..."
            value={composerValue}
          />
          <button
            aria-label="语音输入"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#F2EDE7] bg-warm-cream text-apple-blue transition hover:bg-white"
            onClick={handleOpenChat}
            type="button"
          >
            <MaterialIcon className="text-xl" name="mic" />
          </button>
          <button
            aria-label="发送 AI 消息"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#2D2926] text-white transition hover:bg-black"
            onClick={handleSendHomeMessage}
            type="button"
          >
            <MaterialIcon className="text-xl" name="arrow_upward" />
          </button>
        </div>
      </div>
    </section>
  );
}
