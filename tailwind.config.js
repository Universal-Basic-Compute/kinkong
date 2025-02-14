/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
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
        'darkred/10': 'rgba(139, 0, 0, 0.1)',
        'darkred/20': 'rgba(139, 0, 0, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
};

