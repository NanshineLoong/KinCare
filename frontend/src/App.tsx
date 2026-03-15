import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { listMembers } from "./api/members";
import { AppShell } from "./components/AppShell";
import { MemberManagementModal } from "./components/MemberManagementModal";
import { MemberProfileModal } from "./components/MemberProfileModal";
import { clearSession, readSession, writeSession, type AuthMember, type AuthSession } from "./auth/session";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MemberProfilePage } from "./pages/MemberProfilePage";
import { RegisterPage } from "./pages/RegisterPage";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => {
    const s = readSession();
    if (!s?.user?.id || !s?.member?.id || !s?.tokens?.access_token) {
      if (s) clearSession();
      return null;
    }
    return s;
  });
  const [signedOutPath, setSignedOutPath] = useState("/login");
  const [members, setMembers] = useState<AuthMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  const [isMemberMgmtOpen, setIsMemberMgmtOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadMembers() {
      if (!session) {
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
  }, [session]);

  function handleAuthenticated(nextSession: AuthSession) {
    writeSession(nextSession);
    setSignedOutPath("/login");
    setSession(nextSession);
  }

  function handleSignOut(nextPath = "/login") {
    clearSession();
    setSignedOutPath(nextPath);
    setSession(null);
    setMembers([]);
    setMembersError(null);
  }

  function handleMembersChange(nextMembers: AuthMember[]) {
    setMembers(nextMembers);
  }

  function handleFamilySpaceDeleted() {
    handleSignOut("/register");
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
                onOpenChat={() => setIsChatOpen(true)}
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
                  onFamilySpaceDeleted={handleFamilySpaceDeleted}
                  onMembersChange={handleMembersChange}
                  onOpenMemberProfile={(memberId: string) => setProfileMemberId(memberId)}
                  session={session}
                />
              ) : null
            }
          />
<Route
          path="/app/members/:memberId"
            element={session ? <MemberProfilePage members={members} session={session} /> : null}
          />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>

      {session && profileMemberId && (
        <MemberProfileModal
          memberId={profileMemberId}
          members={members}
          onClose={() => setProfileMemberId(null)}
          open={!!profileMemberId}
          session={session}
        />
      )}

      {session && (
        <MemberManagementModal
          members={members.length > 0 ? members : [session.member]}
          onClose={() => setIsMemberMgmtOpen(false)}
          onMembersChange={handleMembersChange}
          open={isMemberMgmtOpen}
          session={session}
        />
      )}
    </>
  );
}
