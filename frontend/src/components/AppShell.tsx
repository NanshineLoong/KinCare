import { Outlet } from "react-router-dom";
import type { SVGProps } from "react";

import type { AuthSession } from "../auth/session";


type AppShellProps = {
  session: AuthSession;
  onSignOut: () => void;
};

function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 21c-.3 0-.5-.1-.7-.2C6.3 17.7 3 14.6 3 10.5 3 7.9 5.1 6 7.6 6c1.7 0 3.3.8 4.4 2.2C13.1 6.8 14.7 6 16.4 6 18.9 6 21 7.9 21 10.5c0 4.1-3.3 7.2-8.3 10.3-.2.1-.4.2-.7.2Z" />
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

export function AppShell({ session, onSignOut }: AppShellProps) {
  return (
    <div className="min-h-screen bg-warm-cream text-[#2D2926]">
      <header className="sticky top-0 z-20 border-b border-[#F2EDE7] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#ff9d9d_0%,#ff7e7e_100%)] text-white shadow-soft">
              <HeartIcon aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#2D2926]">家庭健康管理</h1>
              <p className="text-[11px] uppercase tracking-[0.28em] text-warm-gray/70">Home Care Assistant</p>
            </div>
          </div>

          <div className="hidden rounded-full bg-[#F5F0EA] px-6 py-2 text-sm font-semibold text-[#2D2926] md:block">
            首页
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-sm font-bold text-[#2D2926]">{session.member.name} 的家</p>
              <p className="text-xs text-warm-gray">
                {session.user.role === "admin" ? "管理员已登录" : "家庭成员已登录"}
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#F2EDE7] bg-white px-4 py-2 text-sm font-semibold text-warm-gray shadow-soft transition hover:text-[#2D2926]"
              onClick={onSignOut}
              type="button"
            >
              <LogOutIcon aria-hidden className="h-4 w-4" />
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[88rem] flex-col gap-8 px-6 py-8 xl:flex-row">
        <aside className="w-full shrink-0 xl:w-80">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-[#2D2926]">成员概览</h2>
            <span className="rounded-full border border-[#F2EDE7] bg-white px-3 py-1 text-xs font-semibold text-warm-gray shadow-soft">
              1 位在线成员
            </span>
          </div>

          <div className="space-y-4">
            <article className="rounded-[2rem] border border-[#F2EDE7]/60 bg-white p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F9EBEA] text-lg font-bold text-[#b86d6d]">
                  {session.member.name.slice(0, 1)}
                </div>
                <div>
                  <p className="font-bold text-[#2D2926]">{session.member.name}</p>
                  <p className="text-xs text-[#4f8a62]">{session.user.role === "admin" ? "管理员账号" : "普通成员账号"}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft-sage px-3 py-3 text-xs text-[#4d6d55]">
                  <p className="font-semibold uppercase tracking-[0.2em] text-[#6c8b73]">身份</p>
                  <p className="mt-2 text-sm font-bold text-[#3E5C3A]">
                    {session.user.role === "admin" ? "家庭管理员" : "家庭成员"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#FEF5ED] px-3 py-3 text-xs text-[#916741]">
                  <p className="font-semibold uppercase tracking-[0.2em] text-[#af855f]">状态</p>
                  <p className="mt-2 text-sm font-bold text-[#9a6d3b]">可继续完善</p>
                </div>
                <div className="rounded-2xl bg-gentle-blue px-3 py-3 text-xs text-[#4c6985]">
                  <p className="font-semibold uppercase tracking-[0.2em] text-[#6a87a4]">成员档案</p>
                  <p className="mt-2 text-sm font-bold text-[#41678b]">已自动创建</p>
                </div>
                <div className="rounded-2xl bg-[#f8f6f3] px-3 py-3 text-xs text-warm-gray/70">
                  <p className="font-semibold uppercase tracking-[0.2em] text-warm-gray/60">下一步</p>
                  <p className="mt-2 text-sm font-bold text-warm-gray">录入健康数据</p>
                </div>
              </div>
            </article>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
