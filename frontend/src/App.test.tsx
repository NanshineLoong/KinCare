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


function createAuthResponse(name: string, email: string, role = "member", memberId = "member-1", userId = "user-1") {
  return {
    user: {
      id: userId,
      family_space_id: "family-1",
      email,
      role,
      created_at: "2026-03-11T00:00:00Z",
    },
    member: {
      id: memberId,
      family_space_id: "family-1",
      user_account_id: userId,
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

function createMember(id: string, name: string, linkedUserId: string | null = null) {
  return {
    id,
    family_space_id: "family-1",
    user_account_id: linkedUserId,
    name,
    gender: "unknown",
    birth_date: null,
    blood_type: null,
    allergies: [],
    medical_history: [],
    avatar_url: null,
    created_at: "2026-03-11T00:00:00Z",
    updated_at: "2026-03-11T00:00:00Z",
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createAuthResponse("王医生", "owner@example.com", "admin")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([createMember("member-1", "王医生", "user-1")]), {
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
    expect(screen.getByText("成员管理台")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/login",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(window.localStorage.getItem("homevital.session")).toContain("owner@example.com");
  });

  it("submits the register form and enters the app shell", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createAuthResponse("李阿姨", "member@example.com")), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([createMember("member-1", "李阿姨", "user-1")]), {
          status: 200,
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

  it("shows all family members to admins and allows management actions", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            createMember("member-1", "管理员", "user-1"),
            createMember("member-2", "普通成员", "user-2"),
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createMember("member-3", "奶奶")), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderApp("/app");

    expect((await screen.findAllByText("普通成员")).length).toBeGreaterThan(0);
    expect(screen.getByText("2 位成员")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加成员" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除 普通成员" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "注销整个家庭空间" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("新成员姓名"), {
      target: { value: "奶奶" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加成员" }));
    expect((await screen.findAllByText("奶奶")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "删除 普通成员" }));
    expect(confirmSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "注销整个家庭空间" }));
    expect(await screen.findByRole("heading", { name: "注册" })).toBeInTheDocument();
    expect(window.localStorage.getItem("homevital.session")).toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/family-space",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows all family members to regular members without admin controls", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("普通成员", "member@example.com", "member", "member-2", "user-2")),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          createMember("member-1", "管理员", "user-1"),
          createMember("member-2", "普通成员", "user-2"),
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    renderApp("/app");

    expect((await screen.findAllByText("管理员")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("普通成员").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "添加成员" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "注销整个家庭空间" })).not.toBeInTheDocument();
  });

  it("returns to the login page after signing out", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([createMember("member-1", "管理员", "user-1")]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderApp("/app");

    expect(await screen.findByRole("heading", { name: "家庭健康管理" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "退出" }));

    expect(await screen.findByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(window.localStorage.getItem("homevital.session")).toBeNull();
  });
});
