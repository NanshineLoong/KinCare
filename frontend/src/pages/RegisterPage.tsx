import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { register } from "../api/auth";
import type { AuthSession } from "../auth/session";
import { isValidUsername, normalizeUsername } from "../auth/username";
import { AuthField, AuthLayout, LockIcon, MailIcon, UserIcon } from "../components/AuthLayout";
import { usePreferences } from "../preferences";


type RegisterPageProps = {
  onAuthenticated: (session: AuthSession) => void;
};

type RegisterFormState = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialState: RegisterFormState = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function RegisterPage({ onAuthenticated }: RegisterPageProps) {
  const { t } = usePreferences();
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
      setErrorMessage(t("registerPasswordMismatch"));
      return;
    }

    if (!isValidUsername(formState.username)) {
      setErrorMessage(t("authUsernameInvalid"));
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await register({
        username: normalizeUsername(formState.username),
        password: formState.password,
        email: formState.email.trim() ? formState.email.trim() : undefined,
      });
      onAuthenticated(session);
      navigate("/app", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("registerFallbackError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      alternateAction={t("registerAlternateAction")}
      alternateHref="/login"
      alternateLabel={t("registerAlternateLabel")}
      description={t("registerDescription")}
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      submitLabel={t("registerSubmit")}
      title={t("registerTitle")}
    >
      <AuthField
        id="register-username"
        icon={UserIcon}
        input={
          <input
            autoComplete="username"
            className="w-full rounded-lg border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/50"
            id="register-username"
            name="username"
            onChange={updateField}
            placeholder={t("registerUsernamePlaceholder")}
            required
            type="text"
            value={formState.username}
          />
        }
        label={t("registerUsername")}
      />
      <AuthField
        id="register-email"
        icon={MailIcon}
        input={
          <input
            autoComplete="email"
            className="w-full rounded-lg border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/50"
            id="register-email"
            name="email"
            onChange={updateField}
            placeholder={t("registerEmailPlaceholder")}
            type="email"
            value={formState.email}
          />
        }
        label={t("registerEmail")}
      />
      <AuthField
        id="register-password"
        icon={LockIcon}
        input={
          <input
            autoComplete="new-password"
            className="w-full rounded-lg border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/50"
            id="register-password"
            name="password"
            onChange={updateField}
            placeholder={t("registerPasswordPlaceholder")}
            required
            type="password"
            value={formState.password}
          />
        }
        label={t("registerPassword")}
      />
      <AuthField
        id="register-confirm-password"
        icon={LockIcon}
        input={
          <input
            autoComplete="new-password"
            className="w-full rounded-lg border border-gentle-blue bg-warm-cream/50 py-3.5 pl-12 pr-4 text-sm text-warm-gray outline-none transition focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/50"
            id="register-confirm-password"
            name="confirmPassword"
            onChange={updateField}
            placeholder={t("registerConfirmPasswordPlaceholder")}
            required
            type="password"
            value={formState.confirmPassword}
          />
        }
        label={t("registerConfirmPassword")}
      />
    </AuthLayout>
  );
}
