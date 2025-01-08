import forms from "@tailwindcss/forms"
import typography from "@tailwindcss/typography"
import animate from "tailwindcss-animate"
import colors from "tailwindcss/colors"
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
      colors: {
        // Figma design uses Sand palette from Radix colors.
        // "Stone" is the closest match in Tailwind colors.
        gray: colors.stone,

        accent: {
          DEFAULT: "var(--accent-9)",
          50: "var(--accent-1)",
          100: "var(--accent-2)",
          200: "var(--accent-3)",
          300: "var(--accent-4)",
          400: "var(--accent-5)",
          500: "var(--accent-6)",
          600: "var(--accent-7)",
          700: "var(--accent-8)",
          800: "var(--accent-10)",
          900: "var(--accent-11)",
          950: "var(--accent-12)",
          // Alpha variants
          a50: "var(--accent-a1)",
          a100: "var(--accent-a2)",
          a200: "var(--accent-a3)",
          a300: "var(--accent-a4)",
          a400: "var(--accent-a5)",
          a500: "var(--accent-a6)",
          a600: "var(--accent-a7)",
          a700: "var(--accent-a8)",
          a800: "var(--accent-a10)",
          a900: "var(--accent-a11)",
          a950: "var(--accent-a12)",
        },
        border: "var(--color-border)",
        label: "var(--color-label)",
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
      keyframes: {
        contentShow: {
          from: {
            opacity: 0,
            transform: "translate(-50%, -48%) scale(0.96)",
          },
          to: {
            opacity: 1,
            transform: "translate(-50%, -50%) scale(1)",
          },
        },
        slideUpAndFade: {
          from: {
            opacity: 0,
            transform: "translateY(100%)",
          },
          to: {
            opacity: 1,
            transform: "translateY(0)",
          },
        },
      },
      animation: {
        "content-show": "contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slideUpAndFade 300ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [forms, typography, animate],
}
export default config
