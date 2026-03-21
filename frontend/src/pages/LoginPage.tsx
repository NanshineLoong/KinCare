import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../api/auth";
import type { AuthSession } from "../auth/session";
import { isValidUsername, normalizeUsername } from "../auth/username";
import { AuthField, AuthLayout } from "../components/AuthLayout";
import { usePreferences } from "../preferences";


type LoginPageProps = {
  onAuthenticated: (session: AuthSession) => void;
};

type LoginFormState = {
  username: string;
  password: string;
  rememberMe: boolean;
};

const initialState: LoginFormState = {
  username: "",
  password: "",
  rememberMe: false,
};

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const { t } = usePreferences();
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

    if (!isValidUsername(formState.username)) {
      setErrorMessage(t("authUsernameInvalid"));
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await login({
        username: normalizeUsername(formState.username),
        password: formState.password,
        remember_me: formState.rememberMe,
      });
      onAuthenticated(session);
      navigate("/app", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("loginFallbackError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      alternateAction={t("loginAlternateAction")}
      alternateHref="/register"
      alternateLabel={t("loginAlternateLabel")}
      description={t("loginDescription")}
      errorMessage={errorMessage}
      extra={
        <label className="flex cursor-pointer items-center gap-2">
          <input
            checked={formState.rememberMe}
            className="h-4 w-4 rounded border-gentle-blue bg-warm-cream/50 text-apple-blue focus:ring-apple-blue"
            name="rememberMe"
            onChange={updateField}
            type="checkbox"
          />
          <span className="text-sm text-warm-gray">{t("loginRemember")}</span>
        </label>
      }
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      submitLabel={t("loginSubmit")}
      title={t("loginTitle")}
    >
      <AuthField
        iconName="person"
        id="login-username"
        input={
          <input
            autoComplete="username"
            className="w-full rounded-lg border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/50"
            id="login-username"
            name="username"
            onChange={updateField}
            placeholder={t("loginUsernamePlaceholder")}
            required
            type="text"
            value={formState.username}
          />
        }
        label={t("loginUsername")}
      />
      <AuthField
        iconName="lock"
        id="login-password"
        input={
          <input
            autoComplete="current-password"
            className="w-full rounded-lg border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-12 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/50"
            id="login-password"
            name="password"
            onChange={updateField}
            placeholder={t("loginPasswordPlaceholder")}
            required
            type={showPassword ? "text" : "password"}
            value={formState.password}
          />
        }
        label={t("loginPassword")}
        trailing={
          <button
            aria-label={showPassword ? t("loginHidePassword") : t("loginShowPassword")}
            className="text-warm-gray"
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
