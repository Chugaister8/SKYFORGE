/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // SKYFORGE Design System
        bg: {
          base:    "#0A0E1A",
          surface: "#0F1629",
          raised:  "#162035",
        },
        border: {
          dim:    "#1E2D47",
          active: "#06B6D4",
        },
        cyan: {
          DEFAULT: "#06B6D4",
          dim:     "#0891B2",
          glow:    "rgba(6,182,212,0.12)",
          subtle:  "rgba(6,182,212,0.06)",
        },
        threat: {
          low:    "#10B981",
          medium: "#F59E0B",
          high:   "#EF4444",
          ew:     "#8B5CF6",
        },
        text: {
          primary:   "#E2E8F0",
          secondary: "#64748B",
          dim:       "#334155",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": "0.625rem",
        xs:    "0.75rem",
        sm:    "0.8125rem",
      },
      borderRadius: {
        DEFAULT: "4px",
        sm:      "2px",
        lg:      "6px",
      },
      boxShadow: {
        cyan:    "0 0 12px rgba(6,182,212,0.25)",
        "cyan-sm":"0 0 6px rgba(6,182,212,0.15)",
        panel:   "0 2px 8px rgba(0,0,0,0.4)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan":       "scan 2s linear infinite",
      },
    },
  },
  plugins: [],
};
