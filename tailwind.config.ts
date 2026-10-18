import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3efe6",
        ink: "#1c1915",
        pine: {
          DEFAULT: "#1f4a38",
          dark: "#143428",
        },
        clay: "#b85a38",
        sand: "#e4d9c8",
        card: "#fffdf9",
        muted: "#5f584e",
      },
      fontFamily: {
        serif: ["Georgia", "Iowan Old Style", "Palatino Linotype", "Palatino", "serif"],
        sans: [
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 25, 21, 0.05), 0 10px 28px rgba(28, 25, 21, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
