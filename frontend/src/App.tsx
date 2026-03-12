import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { listMembers } from "./api/members";
import { AppShell } from "./components/AppShell";
import { clearSession, readSession, writeSession, type AuthMember, type AuthSession } from "./auth/session";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MemberProfilePage } from "./pages/MemberProfilePage";
import { RegisterPage } from "./pages/RegisterPage";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [signedOutPath, setSignedOutPath] = useState("/login");
  const [members, setMembers] = useState<AuthMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

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
        element={session ? <AppShell onSignOut={handleSignOut} session={session} /> : <Navigate replace to={signedOutPath} />}
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
    </Routes>
  );
}
