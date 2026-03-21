import { format, isValid, parse } from "date-fns";
import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";

import { dateFnsLocale } from "./localizedDateLocale";

import "react-day-picker/style.css";

type LocalizedDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  id?: string;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
};

const sizeClasses: Record<NonNullable<LocalizedDateInputProps["size"]>, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2 text-sm",
};

export function LocalizedDateInput({
  value,
  onChange,
  locale,
  id,
  placeholder,
  size = "md",
  className = "",
  disabled = false,
}: LocalizedDateInputProps) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dfLocale = dateFnsLocale(locale);

  const selected = (() => {
    if (!value) return undefined;
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  })();

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayText =
    selected != null
      ? format(selected, "PPP", { locale: dfLocale })
      : (placeholder ?? "");

  const year = new Date().getFullYear();

  return (
    <div className={`relative w-full ${className}`} ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={[
          "w-full rounded-xl border border-[#F2EDE7] outline-none transition focus:border-[#4A6076] flex items-center justify-between gap-2",
          sizeClasses[size],
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#FBF8F5]",
          selected != null ? "text-[#2D2926]" : "text-[#7D746D]",
        ].join(" ")}
        disabled={disabled}
        id={buttonId}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        type="button"
      >
        <span className="min-w-0 truncate text-left">{displayText || "—"}</span>
        <span className="material-symbols-outlined shrink-0 text-[20px] text-[#7D746D]">
          calendar_month
        </span>
      </button>
      {open && !disabled ? (
        <div className="absolute left-0 top-full z-[70] mt-1 min-w-[min(100%,20rem)] rounded-2xl border border-[#F2EDE7] bg-white p-3 shadow-apple-lg">
          <DayPicker
            captionLayout="dropdown"
            defaultMonth={selected ?? new Date()}
            fromYear={1910}
            locale={dfLocale}
            mode="single"
            onSelect={(d) => {
              if (!d) {
                onChange("");
              } else {
                onChange(format(d, "yyyy-MM-dd"));
              }
              setOpen(false);
            }}
            selected={selected}
            toYear={year + 1}
          />
        </div>
      ) : null}
    </div>
  );
}
