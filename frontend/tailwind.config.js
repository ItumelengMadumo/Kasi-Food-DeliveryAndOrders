/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kasi: {
          orange: '#F97316',
          green: '#16A34A',
          yellow: '#EAB308',
          dark: '#1C1917',
        },
      },
    },
  },
  plugins: [],
};
