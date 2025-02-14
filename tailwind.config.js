/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        darkred: '#8B0000',
        gold: '#FFD700',
      },
      typography: (theme) => ({
        gold: {
          css: {
            '--tw-prose-body': theme('colors.gray[300]'),
            '--tw-prose-headings': theme('colors.gold'),
            '--tw-prose-links': theme('colors.gold'),
            '--tw-prose-bold': theme('colors.white'),
            '--tw-prose-counters': theme('colors.gold'),
            '--tw-prose-bullets': theme('colors.gold'),
            '--tw-prose-hr': theme('colors.gold'),
            '--tw-prose-quotes': theme('colors.gray[300]'),
            '--tw-prose-code': theme('colors.white'),
            '--tw-prose-pre-code': theme('colors.white'),
            '--tw-prose-pre-bg': 'rgba(0, 0, 0, 0.5)',
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
