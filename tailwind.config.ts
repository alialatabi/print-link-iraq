import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2.5rem",
        xl: "3rem",
        "2xl": "4rem",
      },
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["'Tajawal'", "'Cairo'", "sans-serif"],
        tajawal: ["'Tajawal'", "'Cairo'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
        cairo: ["Cairo", "sans-serif"],
        omnes: ["'Omnes Arabic'", "Cairo", "sans-serif"],
        noor: ["'Noor'", "Cairo", "sans-serif"],
      },
      colors: {
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        cmyk: {
          cyan: "hsl(var(--cmyk-cyan))",
          magenta: "hsl(var(--cmyk-magenta))",
          yellow: "hsl(var(--cmyk-yellow))",
          key: "hsl(var(--cmyk-key))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(80 60 40 / 0.07), 0 1px 2px -1px rgb(80 60 40 / 0.05)',
        'card-hover': '0 12px 26px -10px rgb(80 60 40 / 0.18), 0 4px 10px -4px rgb(80 60 40 / 0.1)',
        'elevated': '0 8px 22px -8px rgb(80 60 40 / 0.16), 0 2px 6px -2px rgb(80 60 40 / 0.08)',
        'brand': '0 10px 22px -10px hsl(194 87% 47% / 0.45)',
        'brand-hover': '0 12px 28px -10px hsl(194 87% 47% / 0.6)',
        'dark-card': '0 2px 8px 0 rgb(0 0 0 / 0.3), 0 1px 3px -1px rgb(0 0 0 / 0.2)',
        'dark-card-hover': '0 16px 40px -8px rgb(0 0 0 / 0.4), 0 6px 12px -4px rgb(0 0 0 / 0.25)',
        'dark-elevated': '0 8px 24px -4px rgb(0 0 0 / 0.35), 0 4px 8px -2px rgb(0 0 0 / 0.2)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
