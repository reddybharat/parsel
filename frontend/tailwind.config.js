/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parsel: {
          bg: "var(--parsel-bg)",
          surface: "var(--parsel-surface)",
          soft: "var(--parsel-soft)",
          text: "var(--parsel-text)",
          muted: "var(--parsel-muted)",
          primary: "var(--parsel-primary)",
          secondary: "var(--parsel-secondary)",
          tertiary: "var(--parsel-tertiary)",
          neutral: "var(--parsel-neutral)",
          emerald: "var(--parsel-emerald)",
          danger: "var(--parsel-danger)",
          border: "var(--parsel-border)",
        },
      },
    },
  },
  plugins: [],
};
