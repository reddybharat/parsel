import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist Sans", "Geist", "Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "72rem",
      },
      colors: {
        parsel: {
          bg: "var(--parsel-bg)",
          surface: "var(--parsel-surface)",
          soft: "var(--parsel-soft)",
          canvas: "var(--parsel-canvas)",
          text: "var(--parsel-text)",
          muted: "var(--parsel-muted)",
          primary: "var(--parsel-primary)",
          secondary: "var(--parsel-secondary)",
          tertiary: "var(--parsel-tertiary)",
          neutral: "var(--parsel-neutral)",
          emerald: "var(--parsel-emerald)",
          danger: "var(--parsel-danger)",
          border: "var(--parsel-border)",
          "nav-active-bg": "var(--parsel-nav-active-bg)",
          "nav-active-text": "var(--parsel-nav-active-text)",
          inflow: "var(--parsel-inflow)",
          outflow: "var(--parsel-outflow)",
          "success-bg": "var(--parsel-success-bg)",
          "success-text": "var(--parsel-success-text)",
          "danger-bg": "var(--parsel-danger-bg)",
          "danger-text": "var(--parsel-danger-text)",
          "avatar-bg": "var(--parsel-avatar-bg)",
          "icon-bg": "var(--parsel-icon-bg)",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
          7: "hsl(var(--chart-7))",
          8: "hsl(var(--chart-8))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
