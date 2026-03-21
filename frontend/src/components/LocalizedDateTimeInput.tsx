import { useMemo } from "react";

import { LocalizedDateInput } from "./LocalizedDateInput";

type LocalizedDateTimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  size?: "sm" | "md";
  className?: string;
};

function splitDateTime(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [d, t] = value.split("T");
  return { date: d ?? "", time: t?.slice(0, 5) ?? "" };
}

function joinDateTime(date: string, time: string): string {
  if (!date) return "";
  const t = time && time.length >= 5 ? time : "00:00";
  return `${date}T${t}`;
}

const timeInputClass =
  "shrink-0 rounded-xl border border-[#F2EDE7] px-3 py-2 text-sm text-[#2D2926] outline-none transition focus:border-[#4A6076] bg-white";

export function LocalizedDateTimeInput({
  value,
  onChange,
  locale,
  size = "md",
  className = "",
}: LocalizedDateTimeInputProps) {
  const { date, time } = useMemo(() => splitDateTime(value), [value]);

  return (
    <div className={`flex w-full flex-wrap items-stretch gap-2 ${className}`}>
      <div className="min-w-0 flex-1">
        <LocalizedDateInput
          locale={locale}
          onChange={(d) => onChange(joinDateTime(d, time))}
          placeholder=""
          size={size}
          value={date}
        />
      </div>
      <input
        aria-label="time"
        className={timeInputClass}
        disabled={!date}
        onChange={(e) => onChange(joinDateTime(date, e.target.value))}
        type="time"
        value={date ? time : ""}
      />
      {/* Keeps App tests and programmatic fills working; visually hidden. */}
      <input
        aria-hidden
        className="sr-only"
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        type="datetime-local"
        value={value}
      />
    </div>
  );
}
