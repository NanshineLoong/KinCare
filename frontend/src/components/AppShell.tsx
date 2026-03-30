import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { listChatSessions, type ChatSessionListItem } from "../api/chat";
import type { AuthSession } from "../auth/session";
import { MaterialIcon } from "./MaterialIcon";
import { usePreferences, type TranslationKey } from "../preferences";

type AppShellProps = {
  historyRefreshToken?: number;
  onSignOut: () => void;
  session: AuthSession;
  onOpenSettings?: () => void;
  onRestoreChatSession?: (sessionId: string) => void;
};

function resolvePageLabel(
  pathname: string,
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
) {
  if (pathname.startsWith("/app/members/")) {
    return t("appShellMemberProfile");
  }
  if (pathname === "/app" || pathname === "/app/") {
    return t("appShellFamilyDashboard");
  }
  return t("appShellFamilyDashboard");
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
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function formatRelativeTime(
  value: string,
  language: "zh" | "en",
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t("appShellJustNow");
  if (diffMins < 60) return t("appShellMinutesAgo", { count: diffMins });
  if (diffHours < 24) return t("appShellHoursAgo", { count: diffHours });
  if (diffDays === 1) return t("appShellYesterday");
  if (diffDays < 7) return t("appShellDaysAgo", { count: diffDays });
  return date.toLocaleDateString(language === "en" ? "en-US" : "zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

export function AppShell({
  historyRefreshToken = 0,
  onSignOut,
  session,
  onOpenSettings,
  onRestoreChatSession,
}: AppShellProps) {
  const { language, t } = usePreferences();
  const location = useLocation();

  // User dropdown
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Session history dropdown
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
      if (
        historyRef.current &&
        !historyRef.current.contains(event.target as Node)
      ) {
        setHistoryOpen(false);
      }
    }

    if (userMenuOpen || historyOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [userMenuOpen, historyOpen]);

  async function loadHistorySessions() {
    setIsLoadingSessions(true);
    try {
      const data = await listChatSessions(session, { limit: 15 });
      setSessions(
        [...data].sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime(),
        ),
      );
    } catch {
      setSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }

  async function handleToggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) {
      await loadHistorySessions();
    }
  }

  useEffect(() => {
    if (!historyOpen) {
      return;
    }
    void loadHistorySessions();
  }, [historyRefreshToken]);

  function handleRestoreSession(item: ChatSessionListItem) {
    setHistoryOpen(false);
    onRestoreChatSession?.(item.id);
  }

  const avatarColor = getAvatarColor(session.member.name);
  const avatarChar = session.member.name.charAt(0).toUpperCase() || "?";

  return (
    <div className="flex h-screen flex-col bg-warm-cream text-[#2D2926]">
      {/* ── Top navigation bar ───────────────────────────────────────── */}
      <header className="shrink-0 sticky top-0 z-50 border-b border-[#F2EDE7] bg-white/70 backdrop-blur-md">
        <div className="relative mx-auto flex h-20 max-w-[1400px] items-center justify-between px-8">
          {/* Left: KinCare brand */}
          <div className="flex min-w-0 shrink-0 items-center">
            <img
              alt="KinCare"
              className="h-14 w-auto object-contain sm:h-16"
              src="/KinCare.svg"
            />
          </div>

          {/* Center: page title pill */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="rounded-full bg-[#F5F0EA] px-6 py-2 text-sm font-semibold text-[#2D2926]">
              {resolvePageLabel(location.pathname, t)}
            </div>
          </div>

          {/* Right: history + user menu */}
          <div className="flex shrink-0 items-center gap-3">
            {/* Session history dropdown */}
            <div className="relative" ref={historyRef}>
              <button
                aria-expanded={historyOpen}
                aria-haspopup="listbox"
                aria-label={t("appShellHistory")}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-warm-gray transition hover:bg-[#F5F0EA] hover:text-[#2D2926]"
                onClick={handleToggleHistory}
                type="button"
              >
                <MaterialIcon className="text-[22px]" name="history" />
              </button>

              {historyOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#F2EDE7] bg-white py-2 shadow-soft"
                  role="listbox"
                >
                  <div className="px-4 pb-2 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-warm-gray">
                      {t("appShellHistory")}
                    </p>
                  </div>

                  <div className="my-1 border-t border-[#F2EDE7]" />

                  {isLoadingSessions && (
                    <div className="px-4 py-4 text-center text-sm text-warm-gray">
                      {t("appShellLoading")}
                    </div>
                  )}

                  {!isLoadingSessions && sessions.length === 0 && (
                    <div className="px-4 py-4 text-center text-sm text-warm-gray">
                      {t("appShellNoSessions")}
                    </div>
                  )}

                  {!isLoadingSessions && sessions.length > 0 && (
                    <ul className="max-h-72 overflow-y-auto no-scrollbar">
                      {sessions.map((item) => (
                        <li key={item.id}>
                          <button
                            className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition hover:bg-[#F5F0EA]"
                            onClick={() => handleRestoreSession(item)}
                            role="option"
                            type="button"
                          >
                            <p className="truncate text-sm font-semibold text-[#2D2926]">
                              {item.title ?? t("appShellUntitledSession")}
                            </p>
                            <p className="text-[11px] text-warm-gray">
                              {formatRelativeTime(item.updated_at, language, t)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div aria-hidden className="h-8 border-l border-[#F2EDE7]" />

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={t("appShellUserMenu")}
                className="flex items-center gap-3 rounded-xl py-1 pr-1 transition hover:bg-[#F5F0EA]/50"
                onClick={() => setUserMenuOpen((c) => !c)}
                type="button"
              >
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-bold text-[#2D2926]">
                    {`${session.member.name}${t("appShellHomeSuffix")}`}
                  </p>
                  <p className="text-[11px] text-warm-gray">{t("appShellTodayCare")}</p>
                </div>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: avatarColor }}
                >
                  {avatarChar}
                </div>
                <MaterialIcon className="text-[20px] text-warm-gray" name="expand_more" />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-2xl border border-[#F2EDE7] bg-white py-3 shadow-soft"
                  role="menu"
                >
                  {/* Avatar header */}
                  <div className="flex items-center gap-3 px-4 pb-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {avatarChar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#2D2926]">
                        {session.member.name}
                      </p>
                      <p className="text-[11px] text-warm-gray">
                        {session.user.role === "admin"
                          ? t("appShellAdmin")
                          : t("appShellMember")}
                      </p>
                    </div>
                  </div>

                  <div className="my-1.5 border-t border-[#F2EDE7]" />

                  {/* 设置 */}
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#2D2926] transition hover:bg-[#F5F0EA]/60"
                    onClick={() => {
                      onOpenSettings?.();
                      setUserMenuOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F0EA] text-[#7D746D]">
                      <MaterialIcon className="text-[18px]" name="settings" />
                    </span>
                    {t("appShellSettings")}
                  </button>

                  <div className="my-1.5 border-t border-[#F2EDE7]" />

                  {/* 退出登录 */}
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-[#F5F0EA]/60"
                    onClick={() => {
                      onSignOut();
                      setUserMenuOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500">
                      <MaterialIcon className="text-[18px]" name="logout" />
                    </span>
                    {t("appShellSignOut")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main className="mx-auto flex h-[calc(100vh-5rem)] w-full max-w-[1400px] flex-col overflow-hidden px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
