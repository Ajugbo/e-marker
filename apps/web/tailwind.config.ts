import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172521",
        forest: "#1f594b",
        mint: "#d8eee5",
        paper: "#f4f7f2",
        coral: "#d86b4d",
      },
    },
  },
  plugins: [],
};

export default config;