import { type HTMLAttributes, type ReactNode } from "react";

export type CardVariant = "default" | "soft" | "flat";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  rounded?: "card" | "panel";
  children: ReactNode;
};

const variantClasses: Record<CardVariant, string> = {
  default: "bg-white border border-[#F2EDE7]/50 shadow-apple-sm",
  soft: "bg-white/60 border border-white/50 backdrop-blur-sm",
  flat: "bg-[#F5F0EA] border border-transparent",
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6 sm:p-8",
};

const roundedClasses = {
  card: "rounded-card",
  panel: "rounded-panel",
};

export function Card({
  variant = "default",
  padding = "md",
  rounded = "card",
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "relative transition-all duration-300",
        variantClasses[variant],
        paddingClasses[padding],
        roundedClasses[rounded],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

type ActionCardProps = CardProps & {
  hoverable?: boolean;
};

export function ActionCard({
  hoverable = true,
  className = "",
  children,
  ...props
}: ActionCardProps) {
  return (
    <Card
      rounded="panel"
      className={[
        hoverable
          ? "hover:scale-[1.01] hover:shadow-card cursor-pointer"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </Card>
  );
}
