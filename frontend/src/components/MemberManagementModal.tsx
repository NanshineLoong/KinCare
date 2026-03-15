import { useState, useEffect, type FormEvent } from "react";
import type { AuthMember, AuthSession } from "../auth/session";
import { createMember } from "../api/members";

type MemberManagementModalProps = {
  open: boolean;
  onClose: () => void;
  members: AuthMember[];
  session: AuthSession;
  onMembersChange: (members: AuthMember[]) => void;
};

export function MemberManagementModal({
  open,
  onClose,
  members,
  session,
  onMembersChange,
}: MemberManagementModalProps) {
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
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setShowAddForm(false);
      setAddName("");
      setAddError(null);
    }
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-management-title"
    >
      <div
        className="bg-white w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-600">
              <span className="material-symbols-outlined text-xl">manage_accounts</span>
            </div>
            <h2 id="member-management-title" className="text-xl font-bold text-slate-900 tracking-tight">
              成员管理
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052A3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                添加成员
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-[#F8FAFC] p-6">
          <div className="space-y-2">
            {members.map((member) => {
              const isPrimary =
                member.user_account_id === session.user.id && session.user.role === "admin";
              const badgeStyle = member.user_account_id
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-500 border-slate-200";
              const dotColor = member.user_account_id ? "bg-emerald-500" : "bg-slate-400";

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-6 flex-1">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600 border border-slate-200 shadow-sm">
                        {member.name.charAt(0)}
                      </div>
                      {member.user_account_id && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[10px] text-white">
                            check
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-12 flex-1 items-center gap-4">
                      <div className="col-span-3">
                        <h4 className="font-bold text-slate-900">{member.name}</h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                          {isPrimary ? "Primary Administrator" : "Family Member"}
                        </p>
                      </div>
                      <div className="col-span-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-bold border ${badgeStyle}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                          {member.user_account_id ? "已绑定账号" : "未绑定账号"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-semibold text-slate-500">
                          {isPrimary ? "管理员" : "家庭成员"}
                        </span>
                      </div>
                      <div className="col-span-4 flex justify-end gap-1">
                        <span className="px-2.5 py-1 rounded text-[11px] font-bold tracking-wider border bg-slate-800 text-white border-slate-800">
                          读取
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded text-[11px] font-bold tracking-wider border ${
                            isAdmin
                              ? "bg-slate-800 text-white border-slate-800"
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          }`}
                        >
                          写入
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded text-[11px] font-bold tracking-wider border ${
                            isPrimary
                              ? "bg-slate-800 text-white border-slate-800"
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          }`}
                        >
                          管理
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ml-6 p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                    aria-label="设置"
                  >
                    <span className="material-symbols-outlined">tune</span>
                  </button>
                </div>
              );
            })}

            {/* Add Member Form */}
            {showAddForm && (
              <form
                onSubmit={handleAddMember}
                className="p-4 bg-white border-2 border-dashed border-blue-300 rounded-lg"
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="成员姓名"
                    className="flex-1 min-w-[120px] px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    autoFocus
                    disabled={addLoading}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setAddName("");
                        setAddError(null);
                      }}
                      className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                      disabled={addLoading}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={!addName.trim() || addLoading}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0066CC] hover:bg-[#0052A3] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {addLoading ? "添加中..." : "确认"}
                    </button>
                  </div>
                </div>
                {addError && (
                  <p className="mt-2 text-sm text-red-600">{addError}</p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
