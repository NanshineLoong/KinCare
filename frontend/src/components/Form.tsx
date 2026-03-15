import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ChangeEvent,
  forwardRef,
} from "react";

// ─── Input ─────────────────────────────────────────────────────────────────

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: string;
  trailingIcon?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leadingIcon, trailingIcon, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.replace(/\s+/g, "-").toLowerCase();
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-semibold text-[#2D2926]" htmlFor={inputId}>
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leadingIcon && (
            <span className="material-symbols-outlined pointer-events-none absolute left-4 text-warm-gray text-[20px]">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-[#2D2926] placeholder-warm-gray/60",
              "outline-none transition-all duration-200",
              "focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/10",
              error
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-[#F2EDE7] hover:border-[#D9D0C8]",
              leadingIcon ? "pl-10" : "",
              trailingIcon ? "pr-10" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
          {trailingIcon && (
            <span className="material-symbols-outlined pointer-events-none absolute right-4 text-warm-gray text-[20px]">
              {trailingIcon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-warm-gray">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// ─── TextArea ──────────────────────────────────────────────────────────────

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
  rows?: number;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, rows = 4, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.replace(/\s+/g, "-").toLowerCase();
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-semibold text-[#2D2926]" htmlFor={inputId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={[
            "w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm text-[#2D2926] placeholder-warm-gray/60",
            "outline-none transition-all duration-200",
            "focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/10",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-[#F2EDE7] hover:border-[#D9D0C8]",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-warm-gray">{hint}</p>}
      </div>
    );
  }
);
TextArea.displayName = "TextArea";

// ─── Checkbox ──────────────────────────────────────────────────────────────

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function Checkbox({ checked, onChange, label, disabled, className = "" }: CheckboxProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked);
  return (
    <label
      className={[
        "inline-flex items-center gap-3 cursor-pointer select-none",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200",
          checked
            ? "border-apple-blue bg-apple-blue"
            : "border-[#D9D0C8] bg-white hover:border-apple-blue",
        ].join(" ")}
      >
        {checked && (
          <span className="material-symbols-outlined text-white text-[14px] font-bold leading-none">
            check
          </span>
        )}
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
        />
      </span>
      {label && <span className="text-sm text-[#2D2926]">{label}</span>}
    </label>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function Toggle({ checked, onChange, label, disabled, className = "" }: ToggleProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked);
  return (
    <label
      className={[
        "inline-flex items-center gap-3 cursor-pointer select-none",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300",
          checked ? "bg-apple-blue" : "bg-[#D9D0C8]",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
        />
      </span>
      {label && <span className="text-sm font-medium text-[#2D2926]">{label}</span>}
    </label>
  );
}
