import { useState, type ReactNode } from "react";

type AccordionSectionProps = {
  title: string;
  accentColor?: string;
  icon?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  badge?: ReactNode;
};

export function AccordionSection({
  title,
  accentColor = "bg-gray-400",
  icon,
  defaultOpen = false,
  children,
  className = "",
  badge,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={[
        "group bg-white rounded-3xl border border-[#F2F2F7] transition-all duration-200",
        "shadow-apple-xs",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-5 select-none"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          {icon ? (
            <span className="material-symbols-outlined text-[22px] text-warm-gray">
              {icon}
            </span>
          ) : (
            <span className={`w-1.5 h-6 rounded-full ${accentColor}`} />
          )}
          <h3 className="text-[16px] font-bold text-gray-900">{title}</h3>
          {badge}
        </div>
        <span
          className={[
            "material-symbols-outlined text-warm-gray transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}
