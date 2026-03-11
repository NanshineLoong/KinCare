import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { clearSession, readSession, writeSession, type AuthSession } from "./auth/session";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());

  function handleAuthenticated(nextSession: AuthSession) {
    writeSession(nextSession);
    setSession(nextSession);
  }

  function handleSignOut() {
    clearSession();
    setSession(null);
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={session ? "/app" : "/login"} />} />
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
            <AppShell onSignOut={handleSignOut} session={session} />
          ) : (
            <Navigate replace to="/login" />
          )
        }
      >
        <Route path="/app" element={session ? <HomePage session={session} /> : null} />
      </Route>
    </Routes>
  );
}
