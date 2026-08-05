/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Signal console" palette: graphite base, three sentiment-mapped
        // accents (not a single decorative accent) — see frontend design
        // rationale in README.
        graphite: {
          950: "#0F1215",
          900: "#14171C",
          800: "#1B1F26",
          700: "#252A33",
          600: "#333A45",
          400: "#7A8394",
          200: "#C4CAD4",
        },
        signal: {
          positive: "#3ED6B5",
          neutral: "#F2B84B",
          negative: "#FF6B5E",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
