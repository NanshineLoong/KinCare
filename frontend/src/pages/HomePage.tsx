import { startTransition, useEffect, useState, type ChangeEvent, type FormEvent, type SVGProps } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  confirmChatDraft,
  createChatSession,
  streamChatMessage,
  transcribeAudio,
  type ChatSession,
  type ChatToolResult,
} from "../api/chat";
import {
  confirmDocumentExtraction,
  getDashboard,
  getDocumentExtraction,
  type DashboardMemberSummary,
  type DashboardReminder,
  type DashboardResponse,
  uploadMemberDocument,
} from "../api/health";
import { deleteFamilySpace } from "../api/familySpace";
import { createMember, deleteMember } from "../api/members";
import type { AuthMember, AuthSession } from "../auth/session";
import { ChatOverlay, type ChatMessage, type ChatToolCard } from "../components/ChatOverlay";


type HomePageProps = {
  isLoadingMembers: boolean;
  members: AuthMember[];
  membersError: string | null;
  onFamilySpaceDeleted: () => void;
  onMembersChange: (members: AuthMember[]) => void;
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
  reminders: DashboardReminder[];
};

const initialAssistantMessages: ChatMessage[] = [
  {
    id: "assistant-intro",
    role: "assistant",
    content: "您好，我是您的 HomeVital 助手。请先选择成员，或者直接描述今天的健康情况。",
  },
];

function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="m4.9 4.9 2.1 2.1" />
      <path d="m17 17 2.1 2.1" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="m4.9 19.1 2.1-2.1" />
      <path d="m17 7 2.1-2.1" />
    </svg>
  );
}

function SparkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m11.3 3.7 1.2 3.6a1 1 0 0 0 .6.6l3.6 1.2-3.6 1.2a1 1 0 0 0-.6.6l-1.2 3.6-1.2-3.6a1 1 0 0 0-.6-.6L6.9 9.1l3.6-1.2a1 1 0 0 0 .6-.6l1.2-3.6Z" />
      <path d="m17.5 13.5.7 2a.9.9 0 0 0 .5.5l2 .7-2 .7a.9.9 0 0 0-.5.5l-.7 2-.7-2a.9.9 0 0 0-.5-.5l-2-.7 2-.7a.9.9 0 0 0 .5-.5l.7-2Z" />
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function MicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}

function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 12h12" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function CardStatusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 7h16" />
      <path d="M7 4v6" />
      <path d="M17 4v6" />
      <rect x="4" y="7" width="16" height="13" rx="3" />
    </svg>
  );
}

function readHourFromIso(value: string | null) {
  if (!value) {
    return 12;
  }
  const match = value.match(/T(\d{2}):/);
  return match ? Number(match[1]) : 12;
}

function summarizeCondition(summary: DashboardMemberSummary | undefined): SummaryChip {
  if (!summary || summary.active_conditions.length === 0) {
    return {
      label: "慢病管理",
      summary: "期待新记录",
      tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
    };
  }

  return {
    label: "慢病管理",
    summary: summary.active_conditions.join(" · "),
    tone: "border-[#E8F0E6] bg-soft-sage text-[#3E5C3A]",
  };
}

function summarizeLifestyle(summary: DashboardMemberSummary | undefined): SummaryChip {
  const steps = summary?.latest_observations["step-count"];
  const sleep = summary?.latest_observations["sleep-duration"];

  if (steps?.value) {
    return {
      label: "生活习惯",
      summary: `${Math.round(steps.value)} 步`,
      tone: steps.value >= 5000 ? "border-[#E8F0E6] bg-soft-sage text-[#3E5C3A]" : "border-[#FAE6D8] bg-[#FEF5ED] text-[#A67C52]",
    };
  }
  if (sleep?.value) {
    return {
      label: "生活习惯",
      summary: `${sleep.value.toFixed(1)} 小时睡眠`,
      tone: "border-[#FAE6D8] bg-[#FEF5ED] text-[#A67C52]",
    };
  }

  return {
    label: "生活习惯",
    summary: "等待活动记录",
    tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
  };
}

function summarizeVitals(summary: DashboardMemberSummary | undefined): SummaryChip {
  const oxygen = summary?.latest_observations["blood-oxygen"];
  const temperature = summary?.latest_observations["body-temperature"];
  const heartRate = summary?.latest_observations["heart-rate"];

  if (oxygen?.value) {
    return {
      label: "生理指标",
      summary: `血氧 ${oxygen.value}${oxygen.unit ?? ""}`,
      tone: "border-[#DAE8F7] bg-gentle-blue text-[#41678B]",
    };
  }
  if (temperature?.value) {
    return {
      label: "生理指标",
      summary: `体温 ${temperature.value}${temperature.unit ?? ""}`,
      tone: "border-[#DAE8F7] bg-gentle-blue text-[#41678B]",
    };
  }
  if (heartRate?.value) {
    return {
      label: "生理指标",
      summary: `心率 ${heartRate.value}${heartRate.unit ?? ""}`,
      tone: "border-[#DAE8F7] bg-gentle-blue text-[#41678B]",
    };
  }

  return {
    label: "生理指标",
    summary: "期待新记录",
    tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
  };
}

function summarizeMood(summary: DashboardMemberSummary | undefined): SummaryChip {
  if (summary?.latest_encounter?.summary) {
    return {
      label: "心理情绪",
      summary: "最近有就医安排",
      tone: "border-[#FAE6D8] bg-[#FEF5ED] text-[#A67C52]",
    };
  }

  return {
    label: "心理情绪",
    summary: "期待新记录",
    tone: "border-[#F2EDE7] bg-[#F8F6F3] text-warm-gray",
  };
}

function groupReminders(reminders: DashboardReminder[]): ReminderGroup[] {
  const buckets: Record<ReminderGroup["key"], ReminderGroup> = {
    morning: {
      key: "morning",
      label: "清晨的叮嘱",
      reminders: [],
      iconBg: "bg-[#FFF3E4]",
      iconColor: "text-[#E79C32]",
    },
    afternoon: {
      key: "afternoon",
      label: "午后的守候",
      reminders: [],
      iconBg: "bg-[#E9F1FF]",
      iconColor: "text-[#4B77D1]",
    },
    evening: {
      key: "evening",
      label: "晚间小结",
      reminders: [],
      iconBg: "bg-[#F4ECFF]",
      iconColor: "text-[#7A5CC7]",
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
  onFamilySpaceDeleted,
  onMembersChange,
  session,
}: HomePageProps) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [pendingDeleteMemberId, setPendingDeleteMemberId] = useState<string | null>(null);
  const [isDeletingFamilySpace, setIsDeletingFamilySpace] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialAssistantMessages);
  const [chatToolCards, setChatToolCards] = useState<ChatToolCard[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [selectedChatMemberId, setSelectedChatMemberId] = useState("");
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [attachedDocumentIds, setAttachedDocumentIds] = useState<string[]>([]);
  const isAdmin = session.user.role === "admin";
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
  }, [session]);

  useEffect(() => {
    if (!isChatOpen || !queuedMessage) {
      return;
    }
    void sendChatMessage(queuedMessage);
    setQueuedMessage(null);
  }, [isChatOpen, queuedMessage]);

  function updateNewMemberName(event: ChangeEvent<HTMLInputElement>) {
    setNewMemberName(event.target.value);
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = newMemberName.trim();
    if (!trimmedName) {
      setActionError("请输入新成员姓名。");
      return;
    }

    setActionError(null);
    setIsCreatingMember(true);

    try {
      const nextMember = await createMember(session, { name: trimmedName });
      startTransition(() => {
        onMembersChange([...visibleMembers, nextMember]);
      });
      setNewMemberName("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "添加成员失败，请重试。");
    } finally {
      setIsCreatingMember(false);
    }
  }

  async function handleDeleteMember(member: AuthMember) {
    if (!window.confirm(`确认删除成员“${member.name}”吗？`)) {
      return;
    }

    setActionError(null);
    setPendingDeleteMemberId(member.id);

    try {
      await deleteMember(session, member.id);
      startTransition(() => {
        onMembersChange(visibleMembers.filter((item) => item.id !== member.id));
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "删除成员失败，请重试。");
    } finally {
      setPendingDeleteMemberId(null);
    }
  }

  async function handleDeleteFamilySpace() {
    if (!window.confirm("确认注销整个家庭空间吗？此操作会删除全部家庭成员与登录账号。")) {
      return;
    }

    setActionError(null);
    setIsDeletingFamilySpace(true);

    try {
      await deleteFamilySpace(session);
      onFamilySpaceDeleted();
      navigate("/register", { replace: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "注销家庭空间失败，请重试。");
      setIsDeletingFamilySpace(false);
    }
  }

  function resetChatState() {
    setChatMessages(initialAssistantMessages);
    setChatToolCards([]);
    setChatDraft("");
    setChatError(null);
    setChatSession(null);
    setAttachedDocumentIds([]);
    setSelectedChatMemberId(visibleMembers.length === 1 ? visibleMembers[0].id : "");
  }

  function handleOpenChat() {
    setIsChatOpen(true);
    resetChatState();
  }

  function handleSendHomeMessage() {
    const trimmed = composerValue.trim();
    setIsChatOpen(true);
    resetChatState();

    if (!trimmed) {
      return;
    }

    setQueuedMessage(trimmed);
    setComposerValue("");
  }

  async function ensureChatSession() {
    if (chatSession) {
      return chatSession;
    }
    const created = await createChatSession(session, {
      member_id: selectedChatMemberId || null,
      page_context: "home",
    });
    setChatSession(created);
    return created;
  }

  async function sendChatMessage(rawContent: string) {
    const trimmed = rawContent.trim();
    if (!trimmed) {
      return;
    }

    setChatError(null);
    setIsChatBusy(true);
    setChatMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: trimmed }]);

    try {
      const nextSession = await ensureChatSession();
      const events = await streamChatMessage(session, nextSession.id, {
        content: trimmed,
        member_id: selectedChatMemberId || null,
        document_ids: attachedDocumentIds,
        page_context: "home",
      });

      let assistantText = "";
      events.forEach((event) => {
        if (event.event === "tool.result") {
          setChatToolCards((current) => [
            ...current,
            {
              id: `tool-${Date.now()}-${current.length}`,
              result: event.data,
            },
          ]);
        }
        if (event.event === "message.delta" || event.event === "message.completed") {
          assistantText = event.data.content;
        }
      });

      if (assistantText) {
        setChatMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", content: assistantText }]);
      }
      setAttachedDocumentIds([]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "AI 对话发送失败，请重试。");
    } finally {
      setIsChatBusy(false);
    }
  }

  async function handleSendChatMessage() {
    const trimmed = chatDraft.trim();
    if (!trimmed) {
      return;
    }
    setChatDraft("");
    await sendChatMessage(trimmed);
  }

  async function handleAudioUpload(file: File) {
    setChatError(null);
    try {
      const result = await transcribeAudio(session, file);
      setChatDraft(result.text);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "语音转写失败，请重试。");
    }
  }

  async function handleAttachmentUpload(file: File) {
    if (!selectedChatMemberId) {
      setChatError("请先选择成员再上传附件。");
      return;
    }

    setChatError(null);
    setIsChatBusy(true);

    try {
      const document = await uploadMemberDocument(session, selectedChatMemberId, {
        docType: "other",
        file,
      });
      const extraction = await getDocumentExtraction(session, document.id);
      setAttachedDocumentIds((current) => [...current, document.id]);
      setChatToolCards((current) => [
        ...current,
        {
          id: `tool-document-${document.id}`,
          result: {
            tool_name: "document_extraction",
            content: extraction.raw_extraction?.summary ?? `${document.file_name} 已完成抽取。`,
            requires_confirmation: true,
            draft: extraction.raw_extraction,
            meta: {
              document_id: document.id,
              member_id: selectedChatMemberId,
            },
          },
        },
      ]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "附件上传失败，请重试。");
    } finally {
      setIsChatBusy(false);
    }
  }

  async function handleConfirmToolDraft(toolCard: ChatToolCard) {
    if (!toolCard.result.draft) {
      return;
    }

    setChatError(null);
    setIsChatBusy(true);

    try {
      const documentId = typeof toolCard.result.meta.document_id === "string" ? toolCard.result.meta.document_id : null;
      let createdCounts: Record<string, number>;
      if (documentId) {
        const result = await confirmDocumentExtraction(session, documentId, toolCard.result.draft);
        createdCounts = result.created_counts;
      } else {
        const memberId = selectedChatMemberId || session.member.id;
        const result = await confirmChatDraft(session, {
          member_id: memberId,
          draft: toolCard.result.draft,
        });
        createdCounts = result.created_counts;
      }

      setChatToolCards((current) => current.filter((item) => item.id !== toolCard.id));
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-confirm-${Date.now()}`,
          role: "assistant",
          content: `已写入 ${createdCounts.observations ?? 0} 条指标和 ${createdCounts.care_plans ?? 0} 条提醒。`,
        },
      ]);
      await loadDashboardData();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "确认写入失败，请重试。");
    } finally {
      setIsChatBusy(false);
    }
  }

  return (
    <>
      <section className="flex flex-1 flex-col gap-6 pb-28 xl:gap-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-warm-gray/65">HomeVital MVP v1 / Phase 3</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2926] sm:text-4xl">今日贴心提醒</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-warm-gray">
              家人状态、提醒流和 AI 对话入口已经合并到同一块首页面板里，方便在同一视图里查看、记录和追问。
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-apple-blue shadow-soft transition hover:text-[#005fcc]"
            onClick={handleOpenChat}
            type="button"
          >
            <SparkIcon aria-hidden className="h-4 w-4" />
            打开 AI 助手
          </button>
        </div>

        <div className="grid flex-1 gap-8 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#2D2926]">
                <CardStatusIcon aria-hidden className="h-5 w-5 text-[#E67E7E]" />
                家人状态
              </h3>
              <span className="rounded-full border border-[#F2EDE7] bg-white px-3 py-1 text-xs font-semibold text-warm-gray shadow-soft">
                {visibleMembers.length} 位成员
              </span>
            </div>

            {membersError || actionError ? (
              <div className="rounded-[1.6rem] border border-[#f1d6d6] bg-[#fff5f4] px-4 py-4 text-sm text-[#9a5e5e]">
                {membersError ?? actionError}
              </div>
            ) : null}

            {isLoadingMembers && members.length === 0 ? (
              <div className="rounded-[1.6rem] border border-[#F2EDE7]/60 bg-white px-4 py-4 text-sm text-warm-gray">
                正在加载家庭成员...
              </div>
            ) : null}

            <div className="space-y-4">
              {visibleMembers.map((member) => {
                const summary = memberSummaries.get(member.id);
                const chips = [
                  summarizeCondition(summary),
                  summarizeLifestyle(summary),
                  summarizeVitals(summary),
                  summarizeMood(summary),
                ];

                return (
                  <article className="rounded-[2rem] border border-[#F2EDE7]/60 bg-white p-5 shadow-card" key={member.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F9EBEA] text-lg font-bold text-[#b86d6d]">
                          {member.name.slice(0, 1)}
                        </div>
                        <div>
                          <p className="font-bold text-[#2D2926]">{member.name}</p>
                          <p className="text-xs text-[#4f8a62]">
                            {member.id === session.member.id
                              ? isAdmin
                                ? "当前管理员"
                                : "当前成员"
                              : member.user_account_id
                                ? "已绑定账号"
                                : "待完善档案"}
                          </p>
                        </div>
                      </div>

                      {isAdmin && member.id !== session.member.id ? (
                        <button
                          aria-label={`删除 ${member.name}`}
                          className="rounded-full border border-[#F2EDE7] px-3 py-1 text-xs font-semibold text-warm-gray transition hover:border-[#e5c7c2] hover:text-[#a45d5d]"
                          disabled={pendingDeleteMemberId === member.id}
                          onClick={() => void handleDeleteMember(member)}
                          type="button"
                        >
                          {pendingDeleteMemberId === member.id ? "删除中..." : `删除 ${member.name}`}
                        </button>
                      ) : null}
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
                      <Link
                        className="inline-flex items-center gap-2 rounded-full bg-[#F5F0EA] px-4 py-2 text-sm font-semibold text-[#2D2926] transition hover:bg-[#efe7de]"
                        to={`/app/members/${member.id}`}
                      >
                        查看 {member.name} 档案
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {isAdmin ? (
              <div className="rounded-[2rem] border border-[#F2EDE7]/60 bg-white p-5 shadow-soft">
                <h4 className="text-base font-bold text-[#2D2926]">成员管理</h4>
                <p className="mt-2 text-sm leading-6 text-warm-gray">延续 Phase 1 的管理能力，管理员仍可在首页直接维护家庭成员。</p>

                <form className="mt-5 grid gap-3" onSubmit={handleCreateMember}>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="new-member-name">
                    新成员姓名
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] bg-white px-4 py-3 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="new-member-name"
                      onChange={updateNewMemberName}
                      placeholder="例如：奶奶"
                      type="text"
                      value={newMemberName}
                    />
                  </label>
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-[#2D2926] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f1c1a] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isCreatingMember}
                    type="submit"
                  >
                    {isCreatingMember ? "添加中..." : "添加成员"}
                  </button>
                </form>

                <div className="mt-6 rounded-[1.6rem] bg-[#2D2926] px-5 py-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">危险操作</p>
                  <p className="mt-3 text-sm leading-6 text-white/80">
                    注销后会删除当前家庭空间、所有家庭成员和对应登录账号，系统会回到首次注册状态。
                  </p>
                  <button
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2D2926] transition hover:bg-[#f6f1ec] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isDeletingFamilySpace}
                    onClick={() => void handleDeleteFamilySpace()}
                    type="button"
                  >
                    {isDeletingFamilySpace ? "注销中..." : "注销整个家庭空间"}
                  </button>
                </div>
              </div>
            ) : null}
          </aside>

          <div className="flex min-w-0 flex-col gap-8">
            {dashboardError ? (
              <div className="rounded-[2rem] border border-[#f1d6d6] bg-[#fff5f4] px-5 py-4 text-sm text-[#9a5e5e]">
                {dashboardError}
              </div>
            ) : null}

            {isLoadingDashboard ? (
              <div className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-8 text-sm text-warm-gray shadow-card">
                正在整理今日提醒...
              </div>
            ) : null}

            {reminderGroups.length === 0 && !isLoadingDashboard ? (
              <div className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-8 py-10 shadow-card">
                <h3 className="text-2xl font-bold text-[#2D2926]">今天还没有待办提醒</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-warm-gray">可以先进入成员档案补充用药、复诊和指标记录，系统会在后续 AI 阶段生成更完整的每日提醒。</p>
              </div>
            ) : null}

            {reminderGroups.map((group) => (
              <section className="space-y-5" key={group.key}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${group.iconBg} ${group.iconColor}`}>
                    <SunIcon aria-hidden className="h-5 w-5" />
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
                          <SparkIcon aria-hidden className="h-6 w-6" />
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
                        <Link
                          className="text-sm font-semibold text-apple-blue transition hover:text-[#005fcc]"
                          to={`/app/members/${reminder.member_id}`}
                        >
                          去档案页
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-warm-cream via-warm-cream to-transparent px-5 py-5 sm:px-6 sm:py-8">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-[2.5rem] border border-white/80 bg-white px-3 py-3 shadow-card">
          <button
            aria-label="打开 AI 对话"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full text-warm-gray transition hover:bg-[#F7F3EE] hover:text-apple-blue"
            onClick={handleOpenChat}
            type="button"
          >
            <PlusIcon aria-hidden className="h-6 w-6" />
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
            <MicIcon aria-hidden className="h-5 w-5" />
          </button>
          <button
            aria-label="发送 AI 消息"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#2D2926] text-white transition hover:bg-black"
            onClick={handleSendHomeMessage}
            type="button"
          >
            <SendIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isChatOpen ? (
        <ChatOverlay
          draft={chatDraft}
          error={chatError}
          isBusy={isChatBusy}
          memberOptions={visibleMembers.map((member) => ({ id: member.id, name: member.name }))}
          messages={chatMessages}
          onAttachmentUpload={handleAttachmentUpload}
          onAudioUpload={handleAudioUpload}
          onClose={() => setIsChatOpen(false)}
          onConfirmToolDraft={handleConfirmToolDraft}
          onDraftChange={setChatDraft}
          onMemberChange={setSelectedChatMemberId}
          onSend={handleSendChatMessage}
          selectedMemberId={selectedChatMemberId}
          toolCards={chatToolCards}
        />
      ) : null}
    </>
  );
}
