import type { Config } from "tailwindcss";

// Design tokens sourced from:
// 01 Documentation/01 Product Specifications/10 Design System Document.md
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        "nhs-blue": "#005EB8",
        "nhs-dark-blue": "#003087",
        "nhs-light-blue": "#41B6E6",
        // Semantic
        "nhs-green": "#007F3B",
        "success-green-light": "#EAF3DE",
        "success-green-text": "#27500A",
        "nhs-amber": "#ED8B00",
        "amber-light": "#FAEEDA",
        "amber-text": "#633806",
        "nhs-red": "#DA291C",
        "danger-red": "#A32D2D",
        "danger-red-light": "#FDECEA",
        "danger-red-border": "#F09595",
        // Neutrals
        "page-bg": "#F0F4F5",
        "card-bg": "#FFFFFF",
        "surface-secondary": "#F8FAFB",
        "border-default": "#E5E7EB",
        "border-strong": "#D1D5DB",
        "text-primary": "#111827",
        "text-secondary": "#6B7280",
        "text-muted": "#9CA3AF",
        // Special
        "dnacpr-purple-light": "#EEEDFE",
        "dnacpr-purple-text": "#3C3489",
        "ai-blue-light": "#E6F1FB",
        "ai-blue-border": "#B5D4F4",
        "ai-blue-text": "#185FA5",
        "ai-blue-heading": "#0C447C",
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["Courier New", "Courier", "monospace"],
      },
      fontSize: {
        "page-heading": ["18px", { lineHeight: "1.3", fontWeight: "500" }],
        "section-heading": ["15px", { lineHeight: "1.3", fontWeight: "500" }],
        "subsection-heading": [
          "14px",
          { lineHeight: "1.3", fontWeight: "500" },
        ],
        body: ["13px", { lineHeight: "1.6", fontWeight: "400" }],
        secondary: ["12px", { lineHeight: "1.6", fontWeight: "400" }],
        label: ["11px", { lineHeight: "1.6", fontWeight: "400" }],
        tiny: ["10px", { lineHeight: "1.6", fontWeight: "500" }],
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
        input: "8px",
        badge: "20px",
        tag: "6px",
        progress: "3px",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        xxl: "24px",
      },
      boxShadow: {
        modal: "0 20px 60px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
