import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { login } from "../api/auth";
import type { AuthSession } from "../auth/session";
import { AuthField, AuthLayout, LockIcon, MailIcon } from "../components/AuthLayout";


type LoginPageProps = {
  onAuthenticated: (session: AuthSession) => void;
};

type LoginFormState = {
  email: string;
  password: string;
};

const initialState: LoginFormState = {
  email: "",
  password: "",
};

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const session = await login(formState);
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
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      submitLabel="立即登录"
      title="登录"
    >
      <AuthField
        id="login-email"
        icon={MailIcon}
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
          <Link className="text-xs font-medium text-apple-blue hover:underline" to="/register">
            需要帮助？
          </Link>
        }
        id="login-password"
        icon={LockIcon}
        input={
          <input
            autoComplete="current-password"
            className="w-full rounded-2xl border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/25"
            id="login-password"
            name="password"
            onChange={updateField}
            placeholder="请输入您的登录密码"
            required
            type="password"
            value={formState.password}
          />
        }
        label="密码"
      />
    </AuthLayout>
  );
}
