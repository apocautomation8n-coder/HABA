import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        haba: {
          50: "#f4f9f4",
          100: "#e5f2e6",
          200: "#cce5ce",
          300: "#a3d1a7",
          400: "#73b57a",
          500: "#4f9856",
          600: "#3b7c42",
          700: "#306236",
          800: "#2a4f2f",
          900: "#244228",
        },
      },
    },
  },
  plugins: [],
};
export default config;
