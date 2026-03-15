import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { login } from "../api/auth";
import type { AuthSession } from "../auth/session";
import { AuthField, AuthLayout } from "../components/AuthLayout";


type LoginPageProps = {
  onAuthenticated: (session: AuthSession) => void;
};

type LoginFormState = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const initialState: LoginFormState = {
  email: "",
  password: "",
  rememberMe: false,
};

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function updateField(event: ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = event.target;
    const checked = type === "checkbox" ? (event.target as HTMLInputElement).checked : undefined;
    setFormState((current) => ({
      ...current,
      [name]: checked !== undefined ? checked : value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const session = await login({
        email: formState.email,
        password: formState.password,
      });
      onAuthenticated(session);
      navigate("/app", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败，请重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      alternateAction="免费注册"
      alternateHref="/register"
      alternateLabel="还没有账号？"
      description="欢迎回到您的个人健康中心"
      errorMessage={errorMessage}
      extra={
        <label className="flex cursor-pointer items-center gap-2">
          <input
            checked={formState.rememberMe}
            className="h-4 w-4 rounded border-gentle-blue text-apple-blue focus:ring-apple-blue/25"
            name="rememberMe"
            onChange={updateField}
            type="checkbox"
          />
          <span className="text-sm text-warm-gray">记住我的登录状态</span>
        </label>
      }
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      submitLabel="立即登录"
      title="登录"
    >
      <AuthField
        iconName="mail"
        id="login-email"
        input={
          <input
            autoComplete="email"
            className="w-full rounded-2xl border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/25"
            id="login-email"
            name="email"
            onChange={updateField}
            placeholder="请输入您的邮箱地址"
            required
            type="email"
            value={formState.email}
          />
        }
        label="电子邮箱"
      />
      <AuthField
        aside={
          <Link className="text-xs font-medium text-apple-blue hover:underline" to="/forgot-password">
            忘记密码？
          </Link>
        }
        iconName="lock"
        id="login-password"
        input={
          <input
            autoComplete="current-password"
            className="w-full rounded-2xl border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-12 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/25"
            id="login-password"
            name="password"
            onChange={updateField}
            placeholder="请输入您的登录密码"
            required
            type={showPassword ? "text" : "password"}
            value={formState.password}
          />
        }
        label="密码"
        trailing={
          <button
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            className="text-warm-gray/55 hover:text-warm-gray"
            onClick={() => setShowPassword((v) => !v)}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        }
      />
    </AuthLayout>
  );
}
