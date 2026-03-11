import { Link } from "react-router-dom";
import type { FormEvent, ReactNode, SVGProps } from "react";


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
};

type FieldProps = {
  id: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  input: ReactNode;
  aside?: ReactNode;
};

function HealthShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 3 5 6v6c0 4.6 2.8 7.9 7 9 4.2-1.1 7-4.4 7-9V6l-7-3Z" />
      <path d="M9 12h6" />
      <path d="M12 9v6" />
    </svg>
  );
}

function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 4.3 1.7c-.8.8-1.8 1.3-1.8 2.8" />
      <circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

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

function AuthField({ id, label, icon: Icon, input, aside }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-warm-gray" htmlFor={id}>
          {label}
        </label>
        {aside}
      </div>
      <div className="relative group">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-warm-gray/55 transition-colors group-focus-within:text-apple-blue">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        {input}
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
}: AuthLayoutProps) {
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
              <HealthShieldIcon aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-warm-gray">家庭健康管理助手</p>
              <p className="text-[11px] uppercase tracking-[0.24em] text-warm-gray/65">HomeVital</p>
            </div>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue transition hover:bg-apple-blue/15"
            type="button"
          >
            <HelpIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-79px)] items-center justify-center px-6 py-10">
        <div className="w-full max-w-[30rem] overflow-hidden rounded-[2rem] border border-gentle-blue bg-white shadow-card">
          <div className="relative h-52 overflow-hidden bg-gradient-to-br from-gentle-blue via-soft-sage to-warm-cream">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),transparent_50%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.45),transparent_44%)]" />
            <div className="absolute left-6 top-5 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-warm-gray/80 shadow-soft">
              家庭健康中心
            </div>
            <div className="absolute inset-x-8 bottom-0 flex items-end justify-between">
              <div className="mb-6 h-24 w-16 rounded-t-[2rem] rounded-b-[1.4rem] bg-[#c9e6df]" />
              <div className="mb-5 flex h-28 w-20 flex-col items-center justify-end rounded-t-[2.4rem] rounded-b-[1.6rem] bg-[#b6d9ce]">
                <div className="mb-2 h-11 w-11 rounded-full bg-[#f6d4b8]" />
              </div>
              <div className="mb-4 flex h-20 w-14 flex-col items-center justify-end rounded-t-[1.8rem] rounded-b-[1.4rem] bg-white/80">
                <div className="mb-2 h-8 w-8 rounded-full bg-[#f6d4b8]" />
              </div>
              <div className="mb-6 flex h-32 w-24 flex-col items-center justify-end rounded-t-[2.8rem] rounded-b-[1.8rem] bg-[#8ab1a8]">
                <div className="mb-2 h-12 w-12 rounded-full bg-[#f6d4b8]" />
              </div>
            </div>
            <div className="absolute bottom-4 left-0 right-0 h-14 bg-gradient-to-t from-white via-white/85 to-transparent" />
          </div>

          <div className="px-8 pb-10 pt-6">
            <div className="mb-8">
              <h1 className="text-4xl font-bold tracking-tight text-warm-gray">{title}</h1>
              <p className="mt-2 text-sm text-warm-gray/80">{description}</p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              {children}

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
                <span>{isSubmitting ? "处理中..." : submitLabel}</span>
                <ArrowRightIcon aria-hidden className="h-5 w-5" />
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
        © 2026 家庭健康管理助手. 您的健康，我们的承诺.
      </footer>
    </div>
  );
}

export { AuthField };
