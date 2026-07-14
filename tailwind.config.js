/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        brand: {
          50:  "#f0f7ff",
          100: "#e0efff",
          200: "#baddff",
          300: "#7dc0ff",
          400: "#369dfd",
          500: "#0c7de6",
          600: "#005ec4",
          700: "#004a9f",
          800: "#053f83",
          900: "#0a356d",
          950: "#07214a",
        },
      },
    },
  },
  plugins: [],
};
