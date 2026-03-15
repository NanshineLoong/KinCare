import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { confirmChatDraft, createChatSession, streamChatMessage, transcribeAudio, type ChatSession } from "./api/chat";
import { listMembers } from "./api/members";
import { AppShell } from "./components/AppShell";
import { ChatOverlay, type ChatMessage, type ChatToolCard } from "./components/ChatOverlay";
import { MemberManagementModal } from "./components/MemberManagementModal";
import { MemberProfileModal } from "./components/MemberProfileModal";
import { clearSession, readSession, writeSession, type AuthMember, type AuthSession } from "./auth/session";
import { configureSessionManager, refreshSession, shouldRefreshSession } from "./auth/sessionManager";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";


const initialAssistantMessages: ChatMessage[] = [
  {
    id: "assistant-intro",
    role: "assistant",
    content: "您好，我是 HomeVital 助手。请先选择成员，或直接询问当前的健康摘要与提醒。",
  },
];

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStoredSession(): AuthSession | null {
  const stored = readSession();
  if (!stored?.user?.id || !stored?.member?.id || !stored?.tokens?.access_token) {
    if (stored) {
      clearSession();
    }
    return null;
  }
  return stored;
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(loadStoredSession);
  const [isSessionReady, setIsSessionReady] = useState(() => {
    const stored = loadStoredSession();
    return !stored || !shouldRefreshSession(stored);
  });
  const [signedOutPath, setSignedOutPath] = useState("/login");
  const [members, setMembers] = useState<AuthMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  const [isMemberMgmtOpen, setIsMemberMgmtOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialAssistantMessages);
  const [chatToolCards, setChatToolCards] = useState<ChatToolCard[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [selectedChatMemberId, setSelectedChatMemberId] = useState("");
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);

  function handleAuthenticated(nextSession: AuthSession) {
    writeSession(nextSession);
    setSignedOutPath("/login");
    setSession(nextSession);
    setIsSessionReady(true);
    setSelectedChatMemberId(nextSession.member.id);
  }

  function handleSignOut(nextPath = "/login") {
    clearSession();
    setSignedOutPath(nextPath);
    setSession(null);
    setIsSessionReady(true);
    setMembers([]);
    setMembersError(null);
    setIsChatOpen(false);
    resetChatState();
  }

  function handleMembersChange(nextMembers: AuthMember[]) {
    setMembers(nextMembers);
    if (nextMembers.length > 0 && !selectedChatMemberId) {
      setSelectedChatMemberId(nextMembers[0].id);
    }
  }

  function resetChatState() {
    setChatDraft("");
    setChatMessages(initialAssistantMessages);
    setChatToolCards([]);
    setChatError(null);
    setChatSession(null);
  }

  function handleChatMemberChange(memberId: string) {
    setSelectedChatMemberId(memberId);
    resetChatState();
  }

  useEffect(() => {
    configureSessionManager(session, {
      updateSession: (nextSession) => {
        setSignedOutPath("/login");
        setSession(nextSession);
      },
      clearSession: () => {
        handleSignOut("/login");
      },
    });
  }, [session]);

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapSession() {
      if (!session) {
        setIsSessionReady(true);
        return;
      }

      if (!shouldRefreshSession(session)) {
        setIsSessionReady(true);
        return;
      }

      try {
        const refreshedSession = await refreshSession(session);
        if (!isCancelled && refreshedSession) {
          setSession(refreshedSession);
          setSelectedChatMemberId((current) => current || refreshedSession.member.id);
        }
      } catch {
        // Keep the current state so protected screens can surface the request failure.
      } finally {
        if (!isCancelled) {
          setIsSessionReady(true);
        }
      }
    }

    if (session && !isSessionReady) {
      void bootstrapSession();
      return () => {
        isCancelled = true;
      };
    }

    setIsSessionReady(true);
    return () => {
      isCancelled = true;
    };
  }, [isSessionReady, session]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMembers() {
      if (!session || !isSessionReady) {
        setMembers([]);
        setMembersError(null);
        setIsLoadingMembers(false);
        return;
      }

      setIsLoadingMembers(true);
      setMembersError(null);

      try {
        const nextMembers = await listMembers(session);
        if (!isCancelled) {
          setMembers(nextMembers);
          if (!selectedChatMemberId) {
            setSelectedChatMemberId(nextMembers[0]?.id ?? session.member.id);
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setMembers([]);
          setMembersError(error instanceof Error ? error.message : "成员列表加载失败，请重试。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMembers(false);
        }
      }
    }

    void loadMembers();

    return () => {
      isCancelled = true;
    };
  }, [isSessionReady, selectedChatMemberId, session]);

  useEffect(() => {
    if (!isChatOpen || !queuedMessage) {
      return;
    }
    setChatDraft(queuedMessage);
    void handleSendChatMessage(queuedMessage);
    setQueuedMessage(null);
  }, [isChatOpen, queuedMessage]);

  async function ensureChatSession(currentSession: AuthSession): Promise<ChatSession> {
    const currentMemberId = selectedChatMemberId || null;
    if (
      chatSession &&
      chatSession.member_id === currentMemberId &&
      chatSession.page_context === "home"
    ) {
      return chatSession;
    }

    const nextSession = await createChatSession(currentSession, {
      member_id: currentMemberId,
      page_context: "home",
    });
    setChatSession(nextSession);
    return nextSession;
  }

  async function handleSendChatMessage(initialContent?: string) {
    if (!session) {
      return;
    }

    const contentSource = typeof initialContent === "string" ? initialContent : chatDraft;
    const content = contentSource.trim();
    if (!content) {
      return;
    }

    setChatMessages((current) => [
      ...current,
      {
        id: nextId("user"),
        role: "user",
        content,
      },
    ]);
    if (typeof initialContent !== "string") {
      setChatDraft("");
    }
    setChatError(null);
    setIsChatBusy(true);

    try {
      const currentChatSession = await ensureChatSession(session);
      const events = await streamChatMessage(session, currentChatSession.id, {
        content,
        member_id: selectedChatMemberId || null,
        page_context: "home",
      });

      let assistantContent = "";
      const nextToolCards: ChatToolCard[] = [];

      for (const event of events) {
        if (event.event === "message.delta") {
          assistantContent += event.data.content;
          continue;
        }

        if (event.event === "message.completed") {
          assistantContent = event.data.content || assistantContent;
          continue;
        }

        if (event.event === "tool.result" || event.event === "tool.draft" || event.event === "tool.suggest") {
          nextToolCards.push({
            id: nextId("tool"),
            result: event.data,
          });
          continue;
        }

        if (event.event === "tool.error") {
          setChatError(event.data.error);
        }
      }

      if (nextToolCards.length > 0) {
        setChatToolCards((current) => [...current, ...nextToolCards]);
      }

      if (assistantContent) {
        setChatMessages((current) => [
          ...current,
          {
            id: nextId("assistant"),
            role: "assistant",
            content: assistantContent,
          },
        ]);
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "AI 对话失败，请稍后重试。");
    } finally {
      setIsChatBusy(false);
    }
  }

  async function handleConfirmToolDraft(toolCard: ChatToolCard) {
    if (!session || !chatSession || !toolCard.result.tool_call_id || !toolCard.result.draft) {
      return;
    }

    setIsChatBusy(true);
    setChatError(null);

    try {
      const result = await confirmChatDraft(session, chatSession.id, {
        approvals: { [toolCard.result.tool_call_id]: true },
        edits: {},
      });

      setChatToolCards((current) => current.filter((item) => item.id !== toolCard.id));
      if (result.assistant_message) {
        setChatMessages((current) => [
          ...current,
          {
            id: nextId("assistant"),
            role: "assistant",
            content: result.assistant_message,
          },
        ]);
      }
      setDashboardRefreshToken((current) => current + 1);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "草稿确认失败，请稍后重试。");
    } finally {
      setIsChatBusy(false);
    }
  }

  async function handleAudioUpload(file: File) {
    if (!session) {
      return;
    }

    setIsChatBusy(true);
    setChatError(null);
    try {
      const result = await transcribeAudio(session, file);
      setChatDraft((current) => (current ? `${current}\n${result.text}` : result.text));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "语音识别失败，请稍后重试。");
    } finally {
      setIsChatBusy(false);
    }
  }

  function handleOpenChat() {
    setIsChatOpen(true);
  }

  function handleQueueHomeMessage(message: string) {
    resetChatState();
    setQueuedMessage(message);
    setIsChatOpen(true);
  }

  const memberOptions = members.length > 0 ? members : session ? [session.member] : [];

  if (session && !isSessionReady) {
    return null;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate replace to={session ? "/app" : signedOutPath} />} />
        <Route
          path="/login"
          element={
            session ? <Navigate replace to="/app" /> : <LoginPage onAuthenticated={handleAuthenticated} />
          }
        />
        <Route
          path="/register"
          element={
            session ? <Navigate replace to="/app" /> : <RegisterPage onAuthenticated={handleAuthenticated} />
          }
        />
        <Route
          element={
            session ? (
              <AppShell
                onOpenChat={handleOpenChat}
                onOpenMemberManagement={() => setIsMemberMgmtOpen(true)}
                onSignOut={handleSignOut}
                session={session}
              />
            ) : (
              <Navigate replace to={signedOutPath} />
            )
          }
        >
          <Route
            path="/app"
            element={
              session ? (
                <HomePage
                  isLoadingMembers={isLoadingMembers}
                  members={members}
                  membersError={membersError}
                  onOpenChat={handleOpenChat}
                  onOpenMemberProfile={(memberId) => setProfileMemberId(memberId)}
                  onQueueChatMessage={handleQueueHomeMessage}
                  refreshToken={dashboardRefreshToken}
                  session={session}
                />
              ) : null
            }
          />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>

      {session && profileMemberId && (
        <MemberProfileModal
          memberId={profileMemberId}
          members={memberOptions}
          onClose={() => setProfileMemberId(null)}
          open={!!profileMemberId}
          session={session}
        />
      )}

      {session && (
        <MemberManagementModal
          members={memberOptions}
          onClose={() => setIsMemberMgmtOpen(false)}
          onMembersChange={handleMembersChange}
          open={isMemberMgmtOpen}
          session={session}
        />
      )}

      {session && isChatOpen && (
        <ChatOverlay
          draft={chatDraft}
          error={chatError}
          isBusy={isChatBusy}
          memberOptions={memberOptions.map((member) => ({ id: member.id, name: member.name }))}
          messages={chatMessages}
          onAudioUpload={handleAudioUpload}
          onClose={() => setIsChatOpen(false)}
          onConfirmToolDraft={handleConfirmToolDraft}
          onDraftChange={setChatDraft}
          onMemberChange={handleChatMemberChange}
          onSend={handleSendChatMessage}
          selectedMemberId={selectedChatMemberId}
          toolCards={chatToolCards}
        />
      )}
    </>
  );
}
