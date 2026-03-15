import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import type { AuthSession } from "../auth/session";

type AppShellProps = {
  onSignOut: () => void;
  session: AuthSession;
  onOpenMemberManagement?: () => void;
  onOpenChat?: () => void;
};

function resolvePageLabel(pathname: string) {
  if (pathname.startsWith("/app/members/")) {
    return "成员档案";
  }
  return "首页";
}

/** 根据名字生成稳定的头像背景色 */
function getAvatarColor(name: string): string {
  const palette = [
    "#E67E7E", "#4A6076", "#2D4F3E", "#7D746D",
    "#B8860B", "#6B8E23", "#CD5C5C", "#4682B4",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function AppShell({
  onSignOut,
  session,
  onOpenMemberManagement,
  onOpenChat,
}: AppShellProps) {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const avatarColor = getAvatarColor(session.member.name);
  const avatarChar = session.member.name.charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-warm-cream text-[#2D2926]">
      <header className="sticky top-0 z-50 border-b border-[#F2EDE7] bg-white/70 backdrop-blur-md">
        <div className="relative mx-auto flex h-20 max-w-[1400px] items-center justify-between px-8">
          {/* Left: logo + title */}
          <div className="flex min-w-0 shrink-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF9F9F] to-[#FF7B7B] text-white">
              <span className="material-symbols-outlined text-[22px]">favorite</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-[#2D2926]">家庭健康管理</h1>
              <p className="text-[10px] uppercase tracking-widest text-warm-gray">Home Care Assistant</p>
            </div>
          </div>

          {/* Center: nav pill (absolutely centered) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-full bg-[#F5F0EA] px-6 py-2 text-sm font-semibold text-[#2D2926]">
              {resolvePageLabel(location.pathname)}
            </div>
          </div>

          {/* Right: chat, separator, user area, dropdown */}
          <div ref={dropdownRef} className="relative flex shrink-0 items-center gap-4">
            <button
              aria-label="对话"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-warm-gray transition hover:text-[#2D2926]"
              onClick={onOpenChat}
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">forum</span>
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden />
            </button>
            <div className="h-8 border-l border-[#F2EDE7]" aria-hidden />
            <button
              aria-expanded={dropdownOpen}
              aria-haspopup="menu"
              aria-label="用户菜单"
              className="flex items-center gap-3 rounded-lg py-1 pr-1 transition hover:bg-[#F5F0EA]/50"
              onClick={() => setDropdownOpen((o) => !o)}
              type="button"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-[#2D2926]">{session.member.name} 的家</p>
                <p className="text-[11px] text-warm-gray">今日温馨守护中</p>
              </div>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: avatarColor }}
              >
                {avatarChar}
              </div>
              <span className="material-symbols-outlined text-[22px] text-warm-gray">expand_more</span>
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-2xl border border-[#F2EDE7] bg-white py-3 shadow-soft"
                role="menu"
              >
                <div className="flex items-center gap-3 px-4 pb-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {avatarChar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#2D2926]">{session.member.name}</p>
                    <button
                      className="mt-1 rounded-full bg-apple-blue px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90"
                      onClick={() => {
                        onOpenMemberManagement?.();
                        setDropdownOpen(false);
                      }}
                      type="button"
                    >
                      管理家庭
                    </button>
                  </div>
                </div>
                <div className="my-2 border-t border-[#F2EDE7]" />
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#2D2926] transition hover:bg-[#F5F0EA]/50"
                  onClick={() => {
                    onOpenMemberManagement?.();
                    setDropdownOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-soft-sage text-forest-green">
                    <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                  </span>
                  成员管理
                </button>
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#2D2926] transition hover:bg-[#F5F0EA]/50"
                  onClick={() => setDropdownOpen(false)}
                  role="menuitem"
                  type="button"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-warm-gray">
                    <span className="material-symbols-outlined text-[18px]">language</span>
                  </span>
                  语言设置
                </button>
                <div className="my-2 border-t border-[#F2EDE7]" />
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-[#F5F0EA]/50"
                  onClick={() => {
                    onSignOut();
                    setDropdownOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600">
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                  </span>
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1400px] flex-col px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
