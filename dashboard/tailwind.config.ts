import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hive: {
          bg: "#050508",
          card: "#0D1117",
          border: "#1E2D3D",
          primary: "#00FFA3",
          secondary: "#00D4FF",
          warning: "#FFB800",
          error: "#FF4D6D",
          text: "#E2E8F0",
          muted: "#64748B",
          terminal: "#080D12",
        },
      },
      boxShadow: {
        glow: "0 0 24px rgba(0, 255, 163, 0.22)",
        cyan: "0 0 20px rgba(0, 212, 255, 0.2)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(1.25)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;