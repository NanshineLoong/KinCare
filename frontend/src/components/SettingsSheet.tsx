import { useEffect, useState, type FormEvent } from "react";

import { createMember } from "../api/members";
import type { AuthMember, AuthSession } from "../auth/session";

type SettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  members: AuthMember[];
  session: AuthSession;
  onMembersChange: (members: AuthMember[]) => void;
};

type SettingsTab = "members";

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: "members", label: "成员管理", icon: "manage_accounts" },
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
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function SettingsSheet({
  open,
  onClose,
  members,
  session,
  onMembersChange,
}: SettingsSheetProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("members");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const isAdmin = session.user.role === "admin";

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setActiveTab("members");
      setShowAddForm(false);
      setAddName("");
      setAddError(null);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    const name = addName.trim();
    if (!name) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const newMember = await createMember(session, { name });
      onMembersChange([...members, newMember]);
      setShowAddForm(false);
      setAddName("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setAddLoading(false);
    }
  }

  function handleBackdropClick() {
    onClose();
  }

  if (!open) return null;

  return (
    <div
      aria-label="设置"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(45,41,38,0.15)] backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Sheet panel */}
      <div
        className="relative flex h-[85vh] w-[75vw] max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-white/50 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#F2EDE7] px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F0EA]">
              <span className="material-symbols-outlined text-[22px] text-[#7D746D]">
                settings
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2D2926]">设置</h2>
              <p className="text-[13px] text-[#7D746D]">管理家庭成员与账号配置</p>
            </div>
          </div>
          <button
            aria-label="关闭设置"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#7D746D] transition hover:bg-[#F5F0EA] hover:text-[#2D2926]"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {/* Tab navigation */}
        <nav className="flex shrink-0 gap-1 border-b border-[#F2EDE7] px-8 pt-1">
          {TABS.map((tab) => (
            <button
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "border-[#2D2926] text-[#2D2926]"
                  : "border-transparent text-[#7D746D] hover:text-[#2D2926]"
              }`}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6 no-scrollbar">
          {activeTab === "members" && (
            <div className="space-y-2">
              {/* Add member action bar */}
              {isAdmin && !showAddForm && (
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#7D746D]">
                    共 {members.length} 位家庭成员
                  </p>
                  <button
                    className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0052A3]"
                    onClick={() => setShowAddForm(true)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    添加成员
                  </button>
                </div>
              )}

              {/* Member list */}
              {members.map((member) => {
                const isPrimary =
                  member.user_account_id === session.user.id &&
                  session.user.role === "admin";
                const avatarBg = getAvatarColor(member.name);
                const badgeStyle = member.user_account_id
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-50 text-slate-500 border-slate-200";
                const dotColor = member.user_account_id
                  ? "bg-emerald-500"
                  : "bg-slate-400";

                return (
                  <div
                    className="flex items-center justify-between rounded-2xl border border-[#F2EDE7] bg-white p-4 transition hover:border-[#007AFF]/40 hover:shadow-sm"
                    key={member.id}
                  >
                    <div className="flex flex-1 items-center gap-5">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm"
                          style={{ backgroundColor: avatarBg }}
                        >
                          {member.name.charAt(0)}
                        </div>
                        {member.user_account_id && (
                          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#007AFF]">
                            <span className="material-symbols-outlined text-[10px] text-white">
                              check
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info columns */}
                      <div className="grid flex-1 grid-cols-12 items-center gap-4">
                        {/* Name + role */}
                        <div className="col-span-4">
                          <p className="font-bold text-[#2D2926]">{member.name}</p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[#7D746D]">
                            {isPrimary ? "Primary Administrator" : "Family Member"}
                          </p>
                        </div>

                        {/* Account status */}
                        <div className="col-span-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-bold ${badgeStyle}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                            {member.user_account_id ? "已绑定账号" : "未绑定账号"}
                          </span>
                        </div>

                        {/* Role label */}
                        <div className="col-span-2">
                          <span className="text-xs font-semibold text-[#7D746D]">
                            {isPrimary ? "管理员" : "家庭成员"}
                          </span>
                        </div>

                        {/* Permission badges */}
                        <div className="col-span-3 flex justify-end gap-1">
                          <span className="rounded border border-slate-800 bg-slate-800 px-2.5 py-1 text-[11px] font-bold tracking-wider text-white">
                            读取
                          </span>
                          <span
                            className={`rounded border px-2.5 py-1 text-[11px] font-bold tracking-wider ${
                              isAdmin
                                ? "border-slate-800 bg-slate-800 text-white"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                            }`}
                          >
                            写入
                          </span>
                          <span
                            className={`rounded border px-2.5 py-1 text-[11px] font-bold tracking-wider ${
                              isPrimary
                                ? "border-slate-800 bg-slate-800 text-white"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                            }`}
                          >
                            管理
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Settings button */}
                    <button
                      aria-label="成员设置"
                      className="ml-4 rounded-lg p-2 text-[#7D746D] transition hover:bg-[#F5F0EA] hover:text-[#007AFF]"
                      type="button"
                    >
                      <span className="material-symbols-outlined">tune</span>
                    </button>
                  </div>
                );
              })}

              {/* Add member form */}
              {showAddForm && (
                <form
                  className="rounded-2xl border-2 border-dashed border-[#007AFF]/40 bg-white p-4"
                  onSubmit={handleAddMember}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <input
                      autoFocus
                      className="min-w-[160px] flex-1 rounded-xl border border-[#F2EDE7] px-4 py-2.5 text-sm text-[#2D2926] outline-none transition focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                      disabled={addLoading}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="成员姓名"
                      type="text"
                      value={addName}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#7D746D] transition hover:bg-[#F5F0EA]"
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
                        className="rounded-xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0052A3] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!addName.trim() || addLoading}
                        type="submit"
                      >
                        {addLoading ? "添加中..." : "确认添加"}
                      </button>
                    </div>
                  </div>
                  {addError && (
                    <p className="mt-2 text-sm text-red-600">{addError}</p>
                  )}
                </form>
              )}

              {/* Empty state */}
              {members.length === 0 && (
                <div className="rounded-2xl border border-[#F2EDE7] bg-white px-6 py-10 text-center">
                  <span className="material-symbols-outlined text-4xl text-[#7D746D]">
                    group
                  </span>
                  <p className="mt-3 text-sm text-[#7D746D]">暂无家庭成员，点击上方按钮添加</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
