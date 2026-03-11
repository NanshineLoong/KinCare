import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { register } from "../api/auth";
import type { AuthSession } from "../auth/session";
import { AuthField, AuthLayout, LockIcon, MailIcon, UserIcon } from "../components/AuthLayout";


type RegisterPageProps = {
  onAuthenticated: (session: AuthSession) => void;
};

type RegisterFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialState: RegisterFormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function RegisterPage({ onAuthenticated }: RegisterPageProps) {
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

    if (formState.password !== formState.confirmPassword) {
      setErrorMessage("两次输入的密码不一致。");
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await register({
        name: formState.name,
        email: formState.email,
        password: formState.password,
      });
      onAuthenticated(session);
      navigate("/app", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "注册失败，请重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      alternateAction="返回登录"
      alternateHref="/login"
      alternateLabel="已经有账号？"
      description="创建属于您家庭的健康管理空间"
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      submitLabel="创建账号"
      title="注册"
    >
      <AuthField
        id="register-name"
        icon={UserIcon}
        input={
          <input
            autoComplete="name"
            className="w-full rounded-2xl border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/25"
            id="register-name"
            name="name"
            onChange={updateField}
            placeholder="例如：李阿姨"
            required
            type="text"
            value={formState.name}
          />
        }
        label="家庭成员昵称"
      />
      <AuthField
        id="register-email"
        icon={MailIcon}
        input={
          <input
            autoComplete="email"
            className="w-full rounded-2xl border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/25"
            id="register-email"
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
        id="register-password"
        icon={LockIcon}
        input={
          <input
            autoComplete="new-password"
            className="w-full rounded-2xl border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/25"
            id="register-password"
            name="password"
            onChange={updateField}
            placeholder="至少 8 位密码"
            required
            type="password"
            value={formState.password}
          />
        }
        label="密码"
      />
      <AuthField
        id="register-confirm-password"
        icon={LockIcon}
        input={
          <input
            autoComplete="new-password"
            className="w-full rounded-2xl border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/25"
            id="register-confirm-password"
            name="confirmPassword"
            onChange={updateField}
            placeholder="请再次输入密码"
            required
            type="password"
            value={formState.confirmPassword}
          />
        }
        label="确认密码"
      />
    </AuthLayout>
  );
}
