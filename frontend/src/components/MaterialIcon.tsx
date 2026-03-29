import type { ReactNode, SVGProps } from "react";

const commonStrokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
};

const sunIcon = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2" />
    <path d="M12 19.3v2.2" />
    <path d="m4.93 4.93 1.56 1.56" />
    <path d="m17.51 17.51 1.56 1.56" />
    <path d="M2.5 12h2.2" />
    <path d="M19.3 12h2.2" />
    <path d="m4.93 19.07 1.56-1.56" />
    <path d="m17.51 6.49 1.56-1.56" />
  </>
);

const refreshIcon = (
  <>
    <path d="M20 5v5h-5" />
    <path d="M4 19v-5h5" />
    <path d="M6.9 9A7 7 0 0 1 19 10" />
    <path d="M17.1 15A7 7 0 0 1 5 14" />
  </>
);

const iconPaths: Record<string, ReactNode> = {
  add: <path d="M12 5v14M5 12h14" />,
  arrow_forward: <path d="M5 12h14m-5-5 5 5-5 5" />,
  arrow_upward: <path d="M12 19V5m-5 5 5-5 5 5" />,
  auto_awesome: (
    <>
      <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" />
      <path d="m18.5 13.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
      <path d="m5.5 14.5.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z" />
    </>
  ),
  bedtime: (
    <>
      <path d="M14.5 3.5a7.5 7.5 0 1 0 6 11.8A8.5 8.5 0 0 1 14.5 3.5Z" />
      <path d="m6.8 5.8.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5.5-1.1Z" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 7.5" />,
  check_circle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.7 2.7L16.5 9.5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  dark_mode: <path d="M14.5 3.5a7.5 7.5 0 1 0 6 11.8A8.5 8.5 0 0 1 14.5 3.5Z" />,
  event_available: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" />
      <path d="m9 14 2.2 2.2L15.5 12" />
    </>
  ),
  event_note: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16M8 13h8M8 16.5h5" />
    </>
  ),
  event_repeat: refreshIcon,
  expand_more: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  fitness_center: (
    <>
      <path d="M3.5 10v4M6.5 8v8M17.5 8v8M20.5 10v4" />
      <path d="M6.5 12h11" />
    </>
  ),
  group: (
    <>
      <circle cx="9" cy="9" r="2.75" />
      <circle cx="16" cy="10" r="2.25" />
      <path d="M4.5 18c.8-3 3.1-4.8 6.3-4.8S16.3 15 17 18" />
      <path d="M14.4 17.8c.5-1.9 1.9-3.1 4.1-3.3" />
    </>
  ),
  groups: (
    <>
      <circle cx="9" cy="9" r="2.75" />
      <circle cx="16.25" cy="10.25" r="2.4" />
      <path d="M4.6 18c.8-2.9 3.1-4.7 6.2-4.7S16.1 15.1 17 18" />
      <path d="M14.8 17.8c.5-1.8 2.1-2.9 4.4-3.1" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 4v4h4" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  light_mode: sunIcon,
  lock: (
    <>
      <rect x="5.5" y="11" width="13" height="9" rx="2.5" />
      <path d="M8 11V8.5a4 4 0 0 1 8 0V11" />
    </>
  ),
  logout: (
    <>
      <path d="M10 6H7.5A2.5 2.5 0 0 0 5 8.5v7A2.5 2.5 0 0 0 7.5 18H10" />
      <path d="M13 8.5 17.5 12 13 15.5" />
      <path d="M9.5 12h8" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="4" width="6" height="10" rx="3" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3M9 20h6" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c.9-3.6 3.4-5.5 7-5.5s6.1 1.9 7 5.5" />
    </>
  ),
  progress_activity: <path d="M12 3a9 9 0 1 0 9 9" />,
  refresh: refreshIcon,
  local_hospital: (
    <>
      <path d="M12 4.5v15M4.5 12h15" />
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
    </>
  ),
  medication: (
    <>
      <path d="m9 8.5 6 6" />
      <path d="M7.7 15.8a3.7 3.7 0 1 1 5.2-5.2l3.6 3.6a3.7 3.7 0 0 1-5.2 5.2Z" />
    </>
  ),
  restaurant: (
    <>
      <path d="M7 4v8M5 4v4a2 2 0 0 0 4 0V4M17 4v16M17 12c1.7 0 3-1.3 3-3V4h-3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </>
  ),
  visibility: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  visibility_off: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.7 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17.6 17.6 0 0 1-4 4.4" />
      <path d="M6.7 6.8A17.4 17.4 0 0 0 2.5 12s3.5 6 9.5 6c1 0 2-.2 2.9-.5" />
      <path d="M10.6 10.6A2.5 2.5 0 0 0 14 14" />
    </>
  ),
  wb_sunny: sunIcon,
};

type MaterialIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: string;
};

export function MaterialIcon({ name, className, ...props }: MaterialIconProps) {
  const icon = iconPaths[name] ?? <circle cx="12" cy="12" r="8" />;

  return (
    <svg
      aria-hidden="true"
      className={["inline-block shrink-0 align-middle", className].filter(Boolean).join(" ")}
      focusable="false"
      height="1em"
      viewBox="0 0 24 24"
      width="1em"
      {...commonStrokeProps}
      {...props}
    >
      {icon}
    </svg>
  );
}
