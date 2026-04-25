/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf6',
          100: '#d8f1e3',
          500: '#3aa570',
          600: '#2d875b',
          700: '#236d4a',
        },
        ink: {
          900: '#0a0d12',
          800: '#10141b',
          700: '#171c25',
          600: '#1d232e',
          500: '#262d3a',
          400: '#3a4253',
          200: '#a3acc0',
          100: '#cfd6e4',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
