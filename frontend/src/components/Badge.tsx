import { type ReactNode } from "react";

// ─── Badge ─────────────────────────────────────────────────────────────────

export type BadgeVariant =
  | "default"
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "gray";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
};

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-500",
  green: "bg-[#F2F9F1] text-[#3E5C3A] border border-[#E8F0E6]",
  amber: "bg-[#FEF5ED] text-[#A67C52] border border-[#FAE6D8]",
  red: "bg-[#FFF1F1] text-red-600 border border-red-100",
  blue: "bg-[#EBF2F7] text-[#4A6076] border border-[#D0E4F0]",
  gray: "bg-[#F5F0EA] text-warm-gray border border-[#EDE8E2]",
};

const badgeSizeClasses = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-medium",
        badgeVariantClasses[variant],
        badgeSizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

// ─── StatusDot ─────────────────────────────────────────────────────────────

export type StatusLevel = "good" | "attention" | "warning" | "unknown";

type StatusDotProps = {
  level: StatusLevel;
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

const statusDotClasses: Record<StatusLevel, string> = {
  good: "bg-green-500",
  attention: "bg-amber-500",
  warning: "bg-red-500",
  unknown: "bg-gray-300",
};

const statusLabelClasses: Record<StatusLevel, string> = {
  good: "text-green-600",
  attention: "text-amber-600",
  warning: "text-red-600",
  unknown: "text-gray-400",
};

const statusDotSizeClasses = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
};

export function StatusDot({
  level,
  label,
  size = "sm",
  className = "",
}: StatusDotProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1",
        label ? statusLabelClasses[level] : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "rounded-full flex-shrink-0",
          statusDotClasses[level],
          statusDotSizeClasses[size],
        ].join(" ")}
      />
      {label && <span className="text-[10px] font-medium">{label}</span>}
    </span>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────

type AvatarProps = {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  className?: string;
};

const avatarSizeClasses = {
  xs: "w-7 h-7 text-xs",
  sm: "w-9 h-9 text-sm",
  md: "w-12 h-12 text-base",
  lg: "w-16 h-16 text-xl",
  xl: "w-20 h-20 text-2xl",
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const avatarColors = [
  "bg-[#F9EBEA] text-[#B91C1C]",
  "bg-[#EBF2F7] text-[#1D4F6F]",
  "bg-[#F2F9F1] text-[#2D5A27]",
  "bg-[#FEF5ED] text-[#7C4A1E]",
  "bg-[#F0EEFB] text-[#4C3DAD]",
];

function pickColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function Avatar({ name, src, size = "md", ring = true, className = "" }: AvatarProps) {
  const colorClass = pickColor(name);
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden font-bold",
        avatarSizeClasses[size],
        ring ? "ring-2 ring-[#F9EBEA]" : "",
        !src ? colorClass : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
