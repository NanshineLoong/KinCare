import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ScaffoldPage } from "./pages/ScaffoldPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<ScaffoldPage />} />
      </Route>
    </Routes>
  );
}
