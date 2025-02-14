import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        black: "#000000",
        gold: "#FFD700",
        darkred: "#8B0000",
        'gold/20': 'rgba(255, 215, 0, 0.2)',
        'gold/80': 'rgba(255, 215, 0, 0.8)',
        'black/95': 'rgba(0, 0, 0, 0.95)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
};

export default config;
