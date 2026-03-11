import { Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <Outlet />
    </main>
  );
}
