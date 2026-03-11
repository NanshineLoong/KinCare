import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";


function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}


function createAuthResponse(name: string, email: string, role = "member") {
  return {
    user: {
      id: "user-1",
      family_space_id: "family-1",
      email,
      role,
      created_at: "2026-03-11T00:00:00Z",
    },
    member: {
      id: "member-1",
      family_space_id: "family-1",
      user_account_id: "user-1",
      name,
      gender: "unknown",
      birth_date: null,
      blood_type: null,
      allergies: [],
      medical_history: [],
      avatar_url: null,
      created_at: "2026-03-11T00:00:00Z",
      updated_at: "2026-03-11T00:00:00Z",
    },
    tokens: {
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
    },
  };
}


describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects the root route to the login page", async () => {
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "免费注册" })).toBeInTheDocument();
  });

  it("renders the register page with the shared auth style", async () => {
    renderApp("/register");

    expect(await screen.findByRole("heading", { name: "注册" })).toBeInTheDocument();
    expect(screen.getByLabelText("家庭成员昵称")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建账号" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回登录" })).toBeInTheDocument();
  });

  it("submits the login form and enters the app shell", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(createAuthResponse("王医生", "owner@example.com", "admin")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderApp("/login");

    fireEvent.change(screen.getByLabelText("电子邮箱"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "立即登录" }));

    expect(await screen.findByRole("heading", { name: "家庭健康管理" })).toBeInTheDocument();
    expect(screen.getByText("成员概览")).toBeInTheDocument();
    expect(screen.getByText("Phase 1 基础布局已就绪")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/login",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(window.localStorage.getItem("homevital.session")).toContain("owner@example.com");
  });

  it("submits the register form and enters the app shell", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(createAuthResponse("李阿姨", "member@example.com")), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderApp("/register");

    fireEvent.change(screen.getByLabelText("家庭成员昵称"), {
      target: { value: "李阿姨" },
    });
    fireEvent.change(screen.getByLabelText("电子邮箱"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    expect(await screen.findByText("欢迎回来，李阿姨")).toBeInTheDocument();
    expect(screen.getByText("家庭空间概览")).toBeInTheDocument();
  });
});
