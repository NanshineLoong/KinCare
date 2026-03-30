import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "../auth/session";
import { PreferencesProvider } from "../preferences";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";


const loginMock = vi.fn();
const registerMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../api/auth", () => ({
  login: (...args: unknown[]) => loginMock(...args),
  register: (...args: unknown[]) => registerMock(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function createSession(): AuthSession {
  return {
    user: {
      id: "user-1",
      family_space_id: "family-1",
      username: "张三丰",
      email: null,
      preferred_language: null,
      role: "admin",
      created_at: "2026-03-21T09:00:00Z",
    },
    member: {
      id: "member-1",
      family_space_id: "family-1",
      user_account_id: "user-1",
      name: "张三丰",
      gender: "unknown",
      birth_date: null,
      height_cm: null,
      blood_type: null,
      avatar_url: null,
      created_at: "2026-03-21T09:00:00Z",
      updated_at: "2026-03-21T09:00:00Z",
      permission_level: "manage",
    },
    tokens: {
      access_token: "access",
      refresh_token: "refresh",
      token_type: "bearer",
    },
  };
}

function renderWithProviders(node: ReactNode) {
  return render(
    <PreferencesProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </PreferencesProvider>,
  );
}

describe("auth pages", () => {
  beforeEach(() => {
    loginMock.mockReset();
    registerMock.mockReset();
    navigateMock.mockReset();
  });

  it("submits login with username instead of email", async () => {
    const onAuthenticated = vi.fn();
    loginMock.mockResolvedValue(createSession());

    renderWithProviders(<LoginPage onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "张三丰" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "立即登录" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        username: "张三丰",
        password: "Secret123!",
        remember_me: false,
      });
    });
  });

  it("submits register with username and optional email, without auth name", async () => {
    const onAuthenticated = vi.fn();
    registerMock.mockResolvedValue(createSession());

    renderWithProviders(<RegisterPage onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "张三丰" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        username: "张三丰",
        password: "Secret123!",
        email: undefined,
      });
    });
  });

  it("blocks invalid usernames before submit", async () => {
    const onAuthenticated = vi.fn();

    renderWithProviders(<RegisterPage onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "张 三" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    await screen.findByText("用户名只能包含中文、字母、数字、下划线或连字符，长度为 3-24。");
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("renders login hero from a local eager-loaded image and avoids ligature icon spans", () => {
    const onAuthenticated = vi.fn();
    const { container } = renderWithProviders(<LoginPage onAuthenticated={onAuthenticated} />);

    const hero = screen.getByAltText("一家人快乐运动的场景插画");
    expect(hero.tagName).toBe("IMG");
    expect(hero).toHaveAttribute("src", "/auth-card-hero.png");
    expect(hero).toHaveAttribute("loading", "eager");
    expect(container.querySelector(".material-symbols-outlined")).toBeNull();
  });

  it("keeps the auth page non-scrollable while constraining card height responsively", () => {
    const onAuthenticated = vi.fn();
    renderWithProviders(<LoginPage onAuthenticated={onAuthenticated} />);

    const authPage = screen.getByTestId("auth-page");
    const authCard = screen.getByTestId("auth-card");
    const authHero = screen.getByTestId("auth-hero");

    expect(authPage.className).toContain("overflow-y-hidden");
    expect(authCard.className).toContain("max-h-[calc(100svh-11rem)]");
    expect(authCard.className).toContain("min-[900px]:max-h-[720px]");
    expect(authHero.className).toContain("h-[clamp(7rem,18vh,12rem)]");
  });
});
