import forms from "@tailwindcss/forms"
import typography from "@tailwindcss/typography"
import defaultTheme from "tailwindcss/defaultTheme"

const config = {
  darkMode: "selector",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: defaultTheme.fontFamily.sans,
      },
      fontSize: {
        "3xl": [
          "2rem",
          {
            lineHeight: "2.5rem",
            letterSpacing: "0.02rem",
          },
        ],
      },
      spacing: {
        15: "3.75rem",
      },
      boxShadow: {
        paper:
          "0px 8px 40px 0px rgba(0, 0, 0, 0.05), 0px 12px 32px -16px rgba(32, 16, 0, 0.06);",
        "paper-dark":
          "0px 12px 32px -16px rgba(246, 246, 245, 0.07), 0px 8px 40px 0px rgba(0, 0, 0, 0.05)",
        "select-token":
          "0px 0px 0px 0.5px rgba(0, 0, 0, 0.05), 0px 1px 4px 0px rgba(31, 21, 0, 0.1), 0px 2px 1px -1px rgba(0, 0, 0, 0.05), 0px 1px 3px 0px rgba(0, 0, 0, 0.05)",
        "select-token-dark":
          "0px 1px 3px 0px rgba(0, 0, 0, 0.05), 0px 2px 1px -1px rgba(0, 0, 0, 0.05), 0px 1px 4px 0px rgba(254, 254, 243, 0.11), 0px 0px 0px 0.5px rgba(0, 0, 0, 0.05)",
        "switch-token":
          "0px 1px 3px 0px rgba(0, 0, 0, 0.05), 0px 2px 1px -1px rgba(0, 0, 0, 0.05), 0px 1px 4px 0px rgba(31, 21, 0, 0.10), 0px 0px 0px 0.5px rgba(0, 0, 0, 0.05)",
        "switch-token-dark":
          "0px 1px 3px 0px rgba(255, 255, 255, 0.05), 0px 2px 1px -1px rgba(255, 255, 255, 0.05), 0px 1px 4px 0px rgba(224, 234, 255, 0.10), 0px 0px 0px 0.5px rgba(255, 255, 255, 0.05)",
      },
    },
  },
  plugins: [forms, typography],
}
export default config
