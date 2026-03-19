import { Link } from "react-router-dom";
import type { FormEvent, ReactNode, SVGProps } from "react";

import { usePreferences } from "../preferences";

type AuthLayoutProps = {
  title: string;
  description: string;
  alternateLabel: string;
  alternateHref: string;
  alternateAction: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  children: ReactNode;
  /** 表单字段与提交按钮之间的插槽（如“记住我”复选框） */
  extra?: ReactNode;
};

type FieldProps = {
  id: string;
  label: string;
  icon?: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  /** Material Symbols 图标名，与 icon 二选一 */
  iconName?: string;
  input: ReactNode;
  aside?: ReactNode;
  /** 输入框右侧元素（如密码可见性切换按钮） */
  trailing?: ReactNode;
};

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.5 3.2-5.5 7-5.5S18.2 16.5 19 20" />
    </svg>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="4" y="6" width="16" height="12" rx="2.5" />
      <path d="m5 8 7 5 7-5" />
    </svg>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8.5a4 4 0 0 1 8 0V11" />
    </svg>
  );
}

function AuthField({ id, label, icon: Icon, iconName, input, aside, trailing }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-warm-gray" htmlFor={id}>
          {label}
        </label>
        {aside}
      </div>
      <div className="relative group">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-warm-gray/55 transition-colors group-focus-within:text-apple-blue">
          {iconName ? (
            <span aria-hidden className="material-symbols-outlined text-[20px]">{iconName}</span>
          ) : Icon ? (
            <Icon aria-hidden className="h-5 w-5" />
          ) : null}
        </span>
        {input}
        {trailing ? (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-gray/55 hover:text-warm-gray">
            {trailing}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function AuthLayout({
  title,
  description,
  alternateAction,
  alternateHref,
  alternateLabel,
  onSubmit,
  submitLabel,
  isSubmitting,
  errorMessage,
  children,
  extra,
}: AuthLayoutProps) {
  const { t } = usePreferences();
  return (
    <div className="relative min-h-screen overflow-hidden bg-warm-cream text-warm-gray">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute -left-8 top-0 h-72 w-72 rounded-full bg-soft-sage blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gentle-blue blur-[140px]" />
      </div>

      <header className="relative z-10 border-b border-gentle-blue/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue">
              <span aria-hidden className="material-symbols-outlined text-[22px]">health_and_safety</span>
            </div>
            <p className="text-sm font-bold tracking-tight text-warm-gray">{t("authBrand")}</p>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue transition hover:bg-apple-blue/15"
            type="button"
          >
            <span aria-hidden className="material-symbols-outlined text-[22px]">help</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-79px)] items-center justify-center px-6 py-10">
        <div className="w-full max-w-[480px] overflow-hidden rounded-xl border border-gentle-blue bg-white shadow-apple">
          <div className="relative h-12 overflow-hidden bg-gradient-to-br from-gentle-blue via-soft-sage to-warm-cream">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),transparent_50%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.45),transparent_44%)]" />
            <div className="absolute inset-x-6 bottom-0 flex items-end justify-between">
              <div className="mb-2 h-8 w-5 rounded-t-xl rounded-b-md bg-[#c9e6df]" />
              <div className="mb-1.5 flex h-10 w-7 flex-col items-center justify-end rounded-t-lg rounded-b-md bg-[#b6d9ce]">
                <div className="mb-1 h-4 w-4 rounded-full bg-[#f6d4b8]" />
              </div>
              <div className="mb-1 flex h-8 w-5 flex-col items-center justify-end rounded-t-md rounded-b-sm bg-white/80">
                <div className="mb-1 h-3 w-3 rounded-full bg-[#f6d4b8]" />
              </div>
              <div className="mb-2 flex h-12 w-8 flex-col items-center justify-end rounded-t-lg rounded-b-md bg-[#8ab1a8]">
                <div className="mb-1 h-4 w-4 rounded-full bg-[#f6d4b8]" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/90 to-transparent" />
          </div>

          <div className="px-8 pb-10 pt-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-warm-gray">{title}</h1>
              <p className="mt-2 text-sm text-warm-gray/80">{description}</p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              {children}

              {extra}

              {errorMessage ? (
                <div className="rounded-2xl border border-[#f3d3d0] bg-[#fff4f3] px-4 py-3 text-sm text-[#a65d56]">
                  {errorMessage}
                </div>
              ) : null}

              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-apple-blue px-4 py-4 text-base font-bold text-white shadow-apple transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                <span>{isSubmitting ? t("authSubmitting") : submitLabel}</span>
                <span aria-hidden className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-warm-gray/80">
              <span>{alternateLabel}</span>
              <Link className="ml-2 font-bold text-apple-blue hover:underline" to={alternateHref}>
                {alternateAction}
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-4 pb-6 text-center text-xs text-warm-gray/60">
        {t("authFooter")}
      </footer>
    </div>
  );
}

export { AuthField };
