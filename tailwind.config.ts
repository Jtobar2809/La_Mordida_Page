import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // La Mordida brand tokens — grilled, artisanal, fire-forward
        charcoal: {
          DEFAULT: "#1B1712",
          50: "#F5F3F0",
          100: "#E8E3DC",
          200: "#CFC5B8",
          300: "#A99C88",
          400: "#7A6C58",
          500: "#4E4436",
          600: "#332B21",
          700: "#241D16",
          800: "#1B1712",
          900: "#100D09",
        },
        ember: {
          DEFAULT: "#E85C2B",
          50: "#FEF3EE",
          100: "#FDE1D2",
          200: "#FAC0A3",
          300: "#F6996E",
          400: "#F0783F",
          500: "#E85C2B",
          600: "#C7451D",
          700: "#9F361A",
          800: "#7C2C19",
          900: "#5F2417",
        },
        mustard: {
          DEFAULT: "#F0A93A",
          50: "#FEF8EC",
          100: "#FCEBC6",
          200: "#F9D68A",
          300: "#F5BE5C",
          400: "#F0A93A",
          500: "#E28E1B",
          600: "#BB7015",
          700: "#8F5615",
          800: "#6E4416",
          900: "#563714",
        },
        olive: {
          DEFAULT: "#4A5A34",
          50: "#F3F5EE",
          100: "#E1E7D3",
          200: "#C3CFA6",
          300: "#A2B478",
          400: "#7E9556",
          500: "#5E7440",
          600: "#4A5A34",
          700: "#39452A",
          800: "#2B3521",
          900: "#212819",
        },
        cream: "#FBF6EE",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "ember-gradient": "linear-gradient(135deg, #E85C2B 0%, #F0A93A 100%)",
        "char-gradient": "linear-gradient(180deg, #1B1712 0%, #332B21 100%)",
      },
      boxShadow: {
        premium: "0 20px 60px -15px rgba(27, 23, 18, 0.35)",
        glow: "0 0 40px -8px rgba(232, 92, 43, 0.55)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sizzle: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
        sizzle: "sizzle 2.4s ease-in-out infinite",
      },
      borderRadius: {
        bite: "2rem 2rem 2rem 0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
