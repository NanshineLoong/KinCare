import type { SVGProps } from "react";
import { Outlet, useLocation } from "react-router-dom";

import type { AuthSession } from "../auth/session";


type AppShellProps = {
  onSignOut: () => void;
  session: AuthSession;
};

function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 21c-.3 0-.5-.1-.7-.2C6.3 17.7 3 14.6 3 10.5 3 7.9 5.1 6 7.6 6c1.7 0 3.3.8 4.4 2.2C13.1 6.8 14.7 6 16.4 6 18.9 6 21 7.9 21 10.5c0 4.1-3.3 7.2-8.3 10.3-.2.1-.4.2-.7.2Z" />
    </svg>
  );
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M6.5 8.8a5.5 5.5 0 1 1 11 0c0 5.7 2.5 6.6 2.5 7.2 0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1 0-.6 2.5-1.5 2.5-7.2Z" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

function LogOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function resolvePageLabel(pathname: string) {
  if (pathname.startsWith("/app/members/")) {
    return "成员档案";
  }
  return "首页";
}

export function AppShell({ onSignOut, session }: AppShellProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-warm-cream text-[#2D2926]">
      <header className="sticky top-0 z-30 border-b border-[#F2EDE7] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#ff9d9d_0%,#ff7e7e_100%)] text-white shadow-soft">
              <HeartIcon aria-hidden className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-[#2D2926] sm:text-2xl">家庭健康管理</h1>
              <p className="text-[10px] uppercase tracking-[0.28em] text-warm-gray/70">Home Care Assistant</p>
            </div>
          </div>

          <div className="hidden rounded-full bg-[#F5F0EA] px-5 py-2 text-sm font-semibold text-[#2D2926] md:block">
            {resolvePageLabel(location.pathname)}
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              aria-label="通知中心"
              className="hidden h-11 w-11 items-center justify-center rounded-full border border-[#F2EDE7] bg-white text-warm-gray transition hover:text-[#2D2926] md:inline-flex"
              type="button"
            >
              <BellIcon aria-hidden className="h-5 w-5" />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-[#2D2926]">{session.member.name} 的家</p>
              <p className="text-xs text-warm-gray">{session.user.role === "admin" ? "今日温馨守护中" : "家庭成员已登录"}</p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#F2EDE7] bg-white px-4 py-2 text-sm font-semibold text-warm-gray shadow-soft transition hover:text-[#2D2926]"
              onClick={() => onSignOut()}
              type="button"
            >
              <LogOutIcon aria-hidden className="h-4 w-4" />
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-[88rem] flex-col px-5 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
