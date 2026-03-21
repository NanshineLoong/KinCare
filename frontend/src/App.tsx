import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import {
  confirmChatDraft,
  createChatSession,
  listChatMessages,
  streamChatMessage,
  type ChatMessageRead,
  type ChatSession,
} from "./api/chat";
import { listMembers } from "./api/members";
import {
  readyAttachmentContexts,
  type ComposerAttachment,
} from "./attachments";
import { AppShell } from "./components/AppShell";
import {
  ChatOverlay,
  type ChatMessage,
  type ChatToolCard,
} from "./components/ChatOverlay";
import { SettingsSheet } from "./components/SettingsSheet";
import { MemberProfileModal } from "./components/MemberProfileModal";
import {
  clearSession,
  readSession,
  writeSession,
  type AuthMember,
  type AuthSession,
} from "./auth/session";
import {
  configureSessionManager,
  refreshSession,
  shouldRefreshSession,
} from "./auth/sessionManager";
import { useComposerAttachments } from "./hooks/useComposerAttachments";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { usePreferences } from "./preferences";
import { RegisterPage } from "./pages/RegisterPage";

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStoredSession(): AuthSession | null {
  const stored = readSession();
  if (
    !stored?.user?.id ||
    !stored?.member?.id ||
    !stored?.tokens?.access_token
  ) {
    if (stored) {
      clearSession();
    }
    return null;
  }
  return stored;
}

export default function App() {
  const { t } = usePreferences();
  const activeChatRunIdRef = useRef(0);
  const chatSessionRef = useRef<ChatSession | null>(null);
  const forceFreshHomeSessionRef = useRef(false);
  const timelineSequenceRef = useRef(0);
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatToolCards, setChatToolCards] = useState<ChatToolCard[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [selectedChatMemberId, setSelectedChatMemberId] = useState("");
  const [resolvedChatMemberName, setResolvedChatMemberName] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const {
    attachments: chatAttachments,
    clearAttachments: clearChatAttachments,
    hasActiveUploads: isChatUploadingAttachment,
    removeAttachment: removeChatAttachment,
    restoreAttachments: restoreChatAttachments,
    uploadAttachment: uploadChatAttachment,
  } = useComposerAttachments({
    session,
    onSuggestedText: (value) => {
      setChatDraft((current) => (current ? `${current}\n${value}` : value));
    },
    onError: (message) => {
      setChatError(message);
    },
  });

  function nextTimelineSortKey() {
    timelineSequenceRef.current += 1;
    return timelineSequenceRef.current;
  }

  function handleAuthenticated(nextSession: AuthSession) {
    writeSession(nextSession);
    setSignedOutPath("/login");
    setSession(nextSession);
    setIsSessionReady(true);
  }

  function handleSignOut(nextPath = "/login") {
    clearSession();
    setSignedOutPath(nextPath);
    setSession(null);
    setIsSessionReady(true);
    setMembers([]);
    setMembersError(null);
    setIsChatOpen(false);
    setIsSettingsOpen(false);
    resetChatState();
  }

  function handleMembersChange(nextMembers: AuthMember[]) {
    setMembers(nextMembers);
  }

  const memberOptions =
    members.length > 0 ? members : session ? [session.member] : [];

  function memberNameForId(memberId: string | null | undefined) {
    if (!memberId) {
      return null;
    }
    return memberOptions.find((member) => member.id === memberId)?.name ?? null;
  }

  function resetChatState() {
    activeChatRunIdRef.current += 1;
    chatSessionRef.current = null;
    forceFreshHomeSessionRef.current = false;
    timelineSequenceRef.current = 0;
    setChatDraft("");
    clearChatAttachments();
    setChatMessages([]);
    setChatToolCards([]);
    setChatError(null);
    setIsChatBusy(false);
    setChatSession(null);
    setSelectedChatMemberId("");
    setResolvedChatMemberName(null);
  }

  function handleChatMemberChange(memberId: string) {
    setSelectedChatMemberId(memberId);
    setChatError(null);
  }

  function appendSystemMessage(content: string) {
    setChatMessages((current) => [
      ...current,
      {
        id: nextId("system"),
        role: "system",
        content,
        sortKey: nextTimelineSortKey(),
      },
    ]);
  }

  function syncResolvedFocus(
    payload: {
      member_id?: string | null;
      member_name?: string | null;
      resolution_source?: string | null;
    },
    options?: {
      restoreSelection?: boolean;
    },
  ) {
    const memberId = payload.member_id ?? null;
    const memberName = payload.member_name ?? memberNameForId(memberId);
    setResolvedChatMemberName(memberName);
    setChatSession((current) =>
      {
        const nextSession = current
          ? {
              ...current,
              member_id: memberId ?? current.member_id,
            }
          : current;
        chatSessionRef.current = nextSession;
        return nextSession;
      },
    );
    if (options?.restoreSelection) {
      if (payload.resolution_source === "explicit" && memberId) {
        setSelectedChatMemberId(memberId);
      } else {
        setSelectedChatMemberId("");
      }
    }
  }

  function buildFocusMarker(payload: {
    member_id?: string | null;
    member_name?: string | null;
    previous_member_id?: string | null;
    focus_changed?: boolean;
    resolution_source?: string | null;
  }) {
    const memberName = payload.member_name ?? memberNameForId(payload.member_id);
    if (!payload.focus_changed || !memberName) {
      return null;
    }
    if (payload.resolution_source === "inferred") {
      return t("chatFocusInferred", { member: memberName });
    }
    if (payload.resolution_source === "explicit" && payload.previous_member_id) {
      return t("chatFocusSwitched", { member: memberName });
    }
    return null;
  }

  function buildRestoredTimeline(messages: ChatMessageRead[]) {
    const restoredMessages: ChatMessage[] = [];
    let sortKey = 0;
    let latestFocus: {
      member_id?: string | null;
      member_name?: string | null;
      resolution_source?: string | null;
    } | null = null;

    for (const message of messages) {
      const metadata = (message.metadata ?? {}) as Record<string, unknown>;
      const focusPayload = {
        member_id: typeof metadata.resolved_member_id === "string" ? metadata.resolved_member_id : null,
        member_name: typeof metadata.member_name === "string" ? metadata.member_name : null,
        previous_member_id:
          typeof metadata.previous_member_id === "string" ? metadata.previous_member_id : null,
        focus_changed: metadata.focus_changed === true,
        resolution_source:
          typeof metadata.resolution_source === "string" ? metadata.resolution_source : null,
      };

      if (message.role === "user") {
        const marker = buildFocusMarker(focusPayload);
        if (marker) {
          sortKey += 1;
          restoredMessages.push({
            id: `system-${message.id}`,
            role: "system",
            content: marker,
            sortKey,
          });
        }
      }

      if (message.role === "user" || message.role === "assistant") {
        sortKey += 1;
        restoredMessages.push({
          id: message.id,
          role: message.role,
          content: message.content,
          sortKey,
        });
      }

      if (focusPayload.member_id || focusPayload.member_name) {
        latestFocus = focusPayload;
      }
    }

    timelineSequenceRef.current = sortKey;
    return {
      messages: restoredMessages,
      latestFocus,
    };
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
        }
      } catch (error) {
        if (!isCancelled) {
          setMembers([]);
          setMembersError(
            error instanceof Error
              ? error.message
              : "Failed to load members. Please try again later.",
          );
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
  }, [isSessionReady, session]);

  async function ensureChatSession(
    currentSession: AuthSession,
    options?: {
      forceNewSession?: boolean;
    },
  ): Promise<ChatSession> {
    const forceNewSession =
      options?.forceNewSession === true || forceFreshHomeSessionRef.current;
    const currentChatSession = chatSessionRef.current;
    if (
      !forceNewSession &&
      currentChatSession &&
      currentChatSession.page_context === "home"
    ) {
      return currentChatSession;
    }

    const nextSession = await createChatSession(currentSession, {
      member_id: selectedChatMemberId || null,
      page_context: "home",
    });
    chatSessionRef.current = nextSession;
    forceFreshHomeSessionRef.current = false;
    setChatSession(nextSession);
    return nextSession;
  }

  async function handleSendChatMessage(
    initialInput?:
        | string
        | {
            content: string;
            attachments?: ComposerAttachment[];
            forceNewSession?: boolean;
          },
  ) {
    if (!session) {
      return;
    }

    const runId = activeChatRunIdRef.current + 1;
    activeChatRunIdRef.current = runId;
    const isActiveRun = () => activeChatRunIdRef.current === runId;

    const pendingAttachmentState =
      typeof initialInput === "string"
        ? chatAttachments
        : initialInput?.attachments ?? chatAttachments;
    const pendingAttachments = readyAttachmentContexts(pendingAttachmentState);
    const contentSource =
      typeof initialInput === "string"
        ? initialInput
        : initialInput?.content ?? chatDraft;
    const content = contentSource.trim() || (
      pendingAttachments.length > 0
        ? `请结合我刚上传的 ${pendingAttachments.length} 个附件继续分析。`
        : ""
    );
    if (!content) {
      return;
    }

    setChatMessages((current) => [
      ...current,
      {
        id: nextId("user"),
        role: "user",
        content,
        sortKey: nextTimelineSortKey(),
      },
    ]);
    setChatDraft("");
    clearChatAttachments();
    setChatError(null);
    setIsChatBusy(true);

    try {
      const currentChatSession = await ensureChatSession(session, {
        forceNewSession:
          typeof initialInput === "string"
            ? false
            : initialInput?.forceNewSession === true,
      });
      if (!isActiveRun()) {
        return;
      }
      const assistantMessageId = nextId("assistant");
      const assistantSortKey = nextTimelineSortKey();
      let assistantMessageCreated = false;
      let assistantContent = "";

      const syncAssistantMessage = (contentValue: string) => {
        if (!contentValue || !isActiveRun()) {
          return;
        }
        if (!assistantMessageCreated) {
          assistantMessageCreated = true;
          setChatMessages((current) => [
            ...current,
            {
              id: assistantMessageId,
              role: "assistant",
              content: contentValue,
              sortKey: assistantSortKey,
            },
          ]);
          return;
        }
        setChatMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: contentValue }
              : message,
          ),
        );
      };

      await streamChatMessage(session, currentChatSession.id, {
        content,
        attachments: pendingAttachments,
        member_id: selectedChatMemberId || null,
        member_selection_mode: selectedChatMemberId ? "explicit" : "auto",
        page_context: "home",
      }, (event) => {
        if (!isActiveRun()) {
          return;
        }

        if (event.event === "session.started") {
          syncResolvedFocus(event.data);
          const marker = buildFocusMarker(event.data);
          if (marker) {
            appendSystemMessage(marker);
          }
          return;
        }

        if (event.event === "message.delta") {
          assistantContent += event.data.content;
          syncAssistantMessage(assistantContent);
          return;
        }

        if (event.event === "message.completed") {
          assistantContent = event.data.content || assistantContent;
          syncAssistantMessage(assistantContent);
          return;
        }

        if (
          event.event === "tool.result" ||
          event.event === "tool.draft" ||
          event.event === "tool.suggest"
        ) {
          setChatToolCards((current) => [
            ...current,
            {
              id: nextId("tool"),
              result: event.data,
              sortKey: nextTimelineSortKey(),
            },
          ]);
          return;
        }

        if (event.event === "tool.error") {
          setChatError(event.data.error);
        }
      });
    } catch (error) {
      if (!isActiveRun()) {
        return;
      }
      restoreChatAttachments(pendingAttachmentState);
      setChatError(
        error instanceof Error ? error.message : "AI chat failed. Please try again later.",
      );
    } finally {
      if (isActiveRun()) {
        setIsChatBusy(false);
      }
    }
  }

  async function handleConfirmToolDraft(toolCard: ChatToolCard) {
    if (
      !session ||
      !chatSession ||
      !toolCard.result.tool_call_id ||
      !toolCard.result.draft
    ) {
      return;
    }

    setIsChatBusy(true);
    setChatError(null);

    try {
      const result = await confirmChatDraft(session, chatSession.id, {
        approvals: { [toolCard.result.tool_call_id]: true },
        edits: {},
      });

      setChatToolCards((current) =>
        current.filter((item) => item.id !== toolCard.id),
      );
      if (result.assistant_message) {
        setChatMessages((current) => [
          ...current,
          {
            id: nextId("assistant"),
            role: "assistant",
            content: result.assistant_message,
            sortKey: nextTimelineSortKey(),
          },
        ]);
      }
      setDashboardRefreshToken((current) => current + 1);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Failed to confirm the draft. Please try again later.",
      );
    } finally {
      setIsChatBusy(false);
    }
  }

  async function handleAttachmentUpload(file: File) {
    setChatError(null);
    await uploadChatAttachment(file);
  }

  function handleRemoveChatAttachment(attachmentId: string) {
    removeChatAttachment(attachmentId);
  }

  function handleOpenChat() {
    setIsChatOpen(true);
  }

  const restoringSessionIdRef = useRef<string | null>(null);

  async function handleRestoreChatSession(sessionId: string) {
    if (!session) return;
    resetChatState();
    restoringSessionIdRef.current = sessionId;
    const restoredSession = {
      id: sessionId,
      user_id: session.user.id,
      family_space_id: session.user.family_space_id,
      member_id: null,
      title: null,
      summary: null,
      page_context: "home",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    chatSessionRef.current = restoredSession;
    setChatSession(restoredSession);
    setIsChatOpen(true);

    try {
      const messages = await listChatMessages(session, sessionId);
      if (restoringSessionIdRef.current !== sessionId) return;
      const restored = buildRestoredTimeline(messages);
      setChatMessages(restored.messages);
      if (restored.latestFocus) {
        syncResolvedFocus(restored.latestFocus, { restoreSelection: true });
      }
    } catch {
      if (restoringSessionIdRef.current === sessionId) {
        setChatError("加载历史消息失败，请稍后重试。");
      }
    } finally {
      if (restoringSessionIdRef.current === sessionId) {
        restoringSessionIdRef.current = null;
      }
    }
  }

  function handleQueueHomeMessage(
    message: string,
    attachments: ComposerAttachment[],
  ) {
    // Homepage send should start a fresh chat immediately instead of
    // reopening and continuing the last hidden transcript.
    resetChatState();
    forceFreshHomeSessionRef.current = true;
    setIsChatOpen(true);
    void handleSendChatMessage({
      content: message,
      attachments,
      forceNewSession: true,
    });
  }
  if (session && !isSessionReady) {
    return null;
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={<Navigate replace to={session ? "/app" : signedOutPath} />}
        />
        <Route
          path="/login"
          element={
            session ? (
              <Navigate replace to="/app" />
            ) : (
              <LoginPage onAuthenticated={handleAuthenticated} />
            )
          }
        />
        <Route
          path="/register"
          element={
            session ? (
              <Navigate replace to="/app" />
            ) : (
              <RegisterPage onAuthenticated={handleAuthenticated} />
            )
          }
        />
        <Route
          element={
            session ? (
              <AppShell
                onOpenSettings={() => setIsSettingsOpen(true)}
                onRestoreChatSession={handleRestoreChatSession}
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
                  onOpenMemberProfile={(memberId) =>
                    setProfileMemberId(memberId)
                  }
                  onQueueChatMessage={handleQueueHomeMessage}
                  onRefreshData={() =>
                    setDashboardRefreshToken((current) => current + 1)
                  }
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
          refreshToken={dashboardRefreshToken}
          session={session}
        />
      )}

      {session && (
        <SettingsSheet
          members={memberOptions}
          onClose={() => setIsSettingsOpen(false)}
          onFamilySpaceDeleted={() => handleSignOut("/register")}
          onMembersChange={handleMembersChange}
          open={isSettingsOpen}
          session={session}
        />
      )}

      {session && isChatOpen && (
        <ChatOverlay
          attachments={chatAttachments}
          draft={chatDraft}
          error={chatError}
          isBusy={isChatBusy}
          isUploading={isChatUploadingAttachment}
          memberOptions={memberOptions.map((member) => ({
            id: member.id,
            name: member.name,
          }))}
          messages={chatMessages}
          onAttachmentRemove={handleRemoveChatAttachment}
          onAttachmentUpload={handleAttachmentUpload}
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
