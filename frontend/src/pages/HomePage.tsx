import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { deleteFamilySpace } from "../api/familySpace";
import { createMember, deleteMember } from "../api/members";
import type { AuthMember, AuthSession } from "../auth/session";


type HomePageProps = {
  isLoadingMembers: boolean;
  members: AuthMember[];
  membersError: string | null;
  onFamilySpaceDeleted: () => void;
  onMembersChange: (members: AuthMember[]) => void;
  session: AuthSession;
};

const statusCards = [
  {
    title: "健康建档",
    summary: "注册账号已完成，家庭空间已经建立。",
    tone: "bg-soft-sage text-[#3E5C3A]",
  },
  {
    title: "成员管理",
    summary: "下一步可以开始添加老人、儿童等被照护成员。",
    tone: "bg-[#FEF5ED] text-[#9a6d3b]",
  },
  {
    title: "权限准备",
    summary: "管理员与普通成员角色边界已经就绪。",
    tone: "bg-gentle-blue text-[#41678b]",
  },
];

const checklist = [
  "认证、成员列表与家庭空间上下文已经打通",
  "管理员可直接添加成员与删除家庭空间",
  "Phase 2 接入健康事实层与首页聚合数据",
];

export function HomePage({
  isLoadingMembers,
  members,
  membersError,
  onFamilySpaceDeleted,
  onMembersChange,
  session,
}: HomePageProps) {
  const navigate = useNavigate();
  const [newMemberName, setNewMemberName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [pendingDeleteMemberId, setPendingDeleteMemberId] = useState<string | null>(null);
  const [isDeletingFamilySpace, setIsDeletingFamilySpace] = useState(false);
  const isAdmin = session.user.role === "admin";
  const visibleMembers = members.length > 0 ? members : [session.member];

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
      onMembersChange([...visibleMembers, nextMember]);
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
      onMembersChange(visibleMembers.filter((item) => item.id !== member.id));
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

  return (
    <section className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-warm-gray/65">家庭空间概览</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-[#2D2926]">欢迎回来，{session.member.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-warm-gray">
              当前登录身份为 {isAdmin ? "家庭管理员" : "家庭成员"}。当前页面已经接入真实家庭成员列表，
              普通成员可查看全体家庭成员，管理员可继续完成成员维护与家庭空间注销。
            </p>
          </div>
          <div className="rounded-full border border-[#F2EDE7] bg-white px-4 py-2 text-sm font-semibold text-apple-blue shadow-soft">
            HomeVital MVP v1 / Phase 1
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
        <div className="space-y-6">
          <article className="overflow-hidden rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white shadow-card">
            <div className="grid gap-6 px-8 py-8 md:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="inline-flex rounded-full bg-[#F5F0EA] px-4 py-2 text-xs font-semibold tracking-[0.22em] text-warm-gray/80">
                  成员管理台
                </p>
                <h3 className="mt-5 text-3xl font-bold tracking-tight text-[#2D2926]">家庭成员上下文已经接入真实 API</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-warm-gray">
                  当前家庭共有 {visibleMembers.length} 位成员。管理员可以继续添加家庭成员、清理不再使用的成员档案，
                  普通成员则能看到统一的家庭成员列表，方便后续在同一空间内协作。
                </p>
              </div>
              <div className="rounded-[2rem] bg-[linear-gradient(145deg,#f7fbff_0%,#eef5f1_45%,#fcf9f5_100%)] p-5">
                <div className="grid gap-3">
                  {statusCards.map((card) => (
                    <div
                      className={`rounded-[1.4rem] px-4 py-4 text-sm font-medium shadow-soft ${card.tone}`}
                      key={card.title}
                    >
                      <p className="text-xs uppercase tracking-[0.26em] text-current/70">{card.title}</p>
                      <p className="mt-2 leading-6">{card.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-8 py-7 shadow-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-[#2D2926]">家庭成员列表</h3>
                <p className="mt-2 text-sm leading-6 text-warm-gray">
                  {isAdmin ? "管理员可在这里添加或删除成员档案。" : "您当前拥有只读权限，可查看全体家庭成员。"}
                </p>
              </div>
              {isAdmin ? (
                <span className="rounded-full bg-[#F9EBEA] px-4 py-2 text-xs font-semibold tracking-[0.22em] text-[#a76262]">
                  管理员操作区
                </span>
              ) : null}
            </div>

            {membersError || actionError ? (
              <div className="mt-6 rounded-[1.6rem] border border-[#f1d6d6] bg-[#fff5f4] px-4 py-4 text-sm text-[#9a5e5e]">
                {membersError ?? actionError}
              </div>
            ) : null}

            {isAdmin ? (
              <form className="mt-6 grid gap-4 rounded-[2rem] bg-warm-cream px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleCreateMember}>
                <label className="text-sm font-medium text-[#2D2926]" htmlFor="new-member-name">
                  新成员姓名
                  <input
                    className="mt-2 w-full rounded-2xl border border-[#E7DDD1] bg-white px-4 py-3 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                    id="new-member-name"
                    name="newMemberName"
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
            ) : null}

            <div className="mt-6 space-y-4">
              {isLoadingMembers && members.length === 0 ? (
                <div className="rounded-[1.8rem] bg-[#f8f6f3] px-5 py-5 text-sm text-warm-gray">正在加载成员列表...</div>
              ) : null}

              {visibleMembers.map((member) => (
                <article
                  className="flex flex-col gap-4 rounded-[2rem] border border-[#F2EDE7]/70 bg-[#fffdfa] px-5 py-5 md:flex-row md:items-center md:justify-between"
                  key={member.id}
                >
                  <div>
                    <p className="text-lg font-bold text-[#2D2926]">{member.name}</p>
                    <p className="mt-1 text-sm text-warm-gray">
                      {member.user_account_id ? "已关联登录账号，可参与协作" : "尚未关联登录账号，适合先建立被照护档案"}
                    </p>
                  </div>

                  {isAdmin && member.id !== session.member.id ? (
                    <button
                      aria-label={`删除 ${member.name}`}
                      className="inline-flex items-center justify-center rounded-full border border-[#eac7c7] bg-white px-4 py-2 text-sm font-semibold text-[#a45d5d] transition hover:bg-[#fff3f2] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={pendingDeleteMemberId === member.id}
                      onClick={() => void handleDeleteMember(member)}
                      type="button"
                    >
                      {pendingDeleteMemberId === member.id ? "删除中..." : `删除 ${member.name}`}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </article>
        </div>

        <aside className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-6 shadow-card">
          <h3 className="text-xl font-bold tracking-tight text-[#2D2926]">本阶段检查单</h3>
          <ul className="mt-5 space-y-4">
            {checklist.map((item) => (
              <li className="rounded-[1.4rem] bg-warm-cream px-4 py-4 text-sm leading-6 text-warm-gray" key={item}>
                {item}
              </li>
            ))}
          </ul>

          {isAdmin ? (
            <div className="mt-6 rounded-[1.8rem] bg-[#2D2926] px-5 py-5 text-white">
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
          ) : null}
        </aside>
      </div>
    </section>
  );
}
