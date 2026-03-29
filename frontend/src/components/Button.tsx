import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { MaterialIcon } from "./MaterialIcon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#2D2926] text-white hover:bg-black active:scale-[0.98] shadow-apple-sm",
  secondary:
    "bg-white text-[#4A6076] border border-[#F2EDE7] hover:bg-[#F5F0EA] active:scale-[0.98] shadow-apple-xs",
  ghost:
    "bg-transparent text-warm-gray hover:text-[#2D2926] hover:bg-[#F5F0EA] active:scale-[0.98]",
  danger:
    "bg-[#FFF1F1] text-red-600 border border-red-100 hover:bg-red-50 active:scale-[0.98]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-xs gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-7 py-3 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  fullWidth = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 select-none",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <MaterialIcon className="animate-spin text-[1em]" name="progress_activity" />
      ) : (
        iconPosition === "left" && icon
      )}
      <span>{children}</span>
      {!loading && iconPosition === "right" && icon}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  label: string;
  variant?: "default" | "ghost" | "filled";
  size?: "sm" | "md" | "lg";
};

const iconBtnVariantClasses: Record<string, string> = {
  default:
    "bg-white border border-[#F2EDE7] text-warm-gray hover:text-[#2D2926] shadow-apple-xs",
  ghost: "bg-transparent text-warm-gray hover:text-[#2D2926] hover:bg-[#F5F0EA]",
  filled: "bg-[#2D2926] text-white hover:bg-black shadow-apple-sm",
};

const iconBtnSizeClasses: Record<string, string> = {
  sm: "w-8 h-8 text-lg",
  md: "w-10 h-10 text-xl",
  lg: "w-12 h-12 text-2xl",
};

export function IconButton({
  icon,
  label,
  variant = "default",
  size = "md",
  className = "",
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={[
        "inline-flex items-center justify-center rounded-full transition-all duration-200 select-none active:scale-95",
        iconBtnVariantClasses[variant],
        iconBtnSizeClasses[size],
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      {...props}
    >
      <MaterialIcon className="leading-none" name={icon} />
    </button>
  );
}
