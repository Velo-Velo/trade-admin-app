import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f4f5f2",
        ink: "#16181d",
        pine: {
          DEFAULT: "#9f2d00",
          dark: "#7c2300",
        },
        clay: "#7c2300",
        sand: "#d7dbd4",
        card: "#ffffff",
        muted: "#3e453e",
      },
      fontFamily: {
        serif: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 25, 21, 0.05), 0 10px 28px rgba(28, 25, 21, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
