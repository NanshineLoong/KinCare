import { Link } from "react-router-dom";
import type { FormEvent, ReactNode, SVGProps } from "react";

import { usePreferences } from "../preferences";

/** Hero image aligned with `stitch_/login/code.html` */
const AUTH_CARD_HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDi8CTXj8_tmtlfvnHbJ35Oz-IeW2ipB_2r_mDwL-E3VOBXLVUKTy76LGFs-tPRmugoOuRqU7WcKMorcp4InY25CGY3RfSHcfzeLKa4BsSewIQh2XV-9_HXiEKQQgQdlnDqnQxuH0NiceijADpzpZIYTOV-rgqPAPyATupM7aLmnhl7CE4XxjbgvfiChdfkA1ee19VxC2uXg81wh1Ave3aKyx5E8DDhYKOtYgxFa48XvrIu84291qpLQW0TX6zyY4-00rLI_xwlhFY";

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
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-warm-gray opacity-50 transition-colors group-focus-within:text-apple-blue group-focus-within:opacity-100">
          {iconName ? (
            <span aria-hidden className="material-symbols-outlined text-[20px]">
              {iconName}
            </span>
          ) : Icon ? (
            <Icon aria-hidden className="h-5 w-5" />
          ) : null}
        </span>
        {input}
        {trailing ? (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-gray opacity-50 transition-opacity hover:opacity-100">
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
        <div className="mx-auto flex max-w-[1400px] items-center px-6 py-4 sm:px-8">
          <div className="flex min-w-0 shrink-0 items-center">
            <img
              alt="KinCare"
              className="h-14 w-auto object-contain sm:h-16"
              src="/KinCare.svg"
            />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-79px)] items-center justify-center px-6 py-10">
        <div className="w-full max-w-[480px] overflow-hidden rounded-xl border border-gentle-blue bg-white shadow-apple transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.01] hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          <div
            aria-label={t("authCardHeroAlt")}
            className="relative h-48 w-full bg-cover bg-center bg-no-repeat"
            role="img"
            style={{ backgroundImage: `url("${AUTH_CARD_HERO_IMAGE}")` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
          </div>

          <div className="px-8 pb-10 pt-4">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-warm-gray">{title}</h1>
              <p className="mt-2 text-sm text-warm-gray/80">{description}</p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              {children}

              {extra}

              {errorMessage ? (
                <div className="rounded-lg border border-[#f3d3d0] bg-[#fff4f3] px-4 py-3 text-sm text-[#a65d56]">
                  {errorMessage}
                </div>
              ) : null}

              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-apple-blue px-4 py-4 text-base font-bold text-white shadow-lg shadow-apple-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
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
