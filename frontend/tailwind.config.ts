import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "warm-cream": "#FCF9F5",
        "soft-sage": "#E8F0E6",
        "gentle-blue": "#EBF2F7",
        "warm-gray": "#7D746D",
        "apple-blue": "#007AFF",
      },
      boxShadow: {
        card: "0 18px 48px rgba(45, 41, 38, 0.08)",
        soft: "0 10px 28px rgba(45, 41, 38, 0.06)",
        apple: "0 14px 32px rgba(0, 122, 255, 0.22)",
      },
      fontFamily: {
        sans: ["Quicksand", '"Noto Sans SC"', "sans-serif"],
      },
      borderRadius: {
        card: "2rem",
        panel: "2.5rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
