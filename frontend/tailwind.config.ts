import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "warm-cream": "#FCF9F5",
        "soft-sage": "#E8F0E6",
        "muted-rose": "#F9EBEA",
        "gentle-blue": "#EBF2F7",
        "warm-gray": "#7D746D",
        "heart-red": "#E67E7E",
        "apple-blue": "#007AFF",
        "forest-green": "#2D4F3E",
        "elegant-blue": "#4A6076",
        "apple-border": "#F2F2F7",
      },
      boxShadow: {
        card: "0 18px 48px rgba(45, 41, 38, 0.08)",
        soft: "0 10px 28px rgba(45, 41, 38, 0.06)",
        apple: "0 14px 32px rgba(0, 122, 255, 0.22)",
        "apple-sm": "0 8px 30px rgba(0, 0, 0, 0.04)",
        "apple-xs": "0 4px 20px rgba(0, 0, 0, 0.03)",
      },
      fontFamily: {
        sans: ["Quicksand", "Inter", '"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        card: "2rem",
        panel: "2.5rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
