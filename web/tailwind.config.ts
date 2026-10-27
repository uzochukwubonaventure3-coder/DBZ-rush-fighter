import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: { 950: '#0a0b10', 900: '#10121a', 800: '#171a25', 700: '#232738', 600: '#343a52' }, ember: { 400: '#ffb04a', 500: '#ff9419', 600: '#e07800' } },
    fontFamily: { sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'] } } },
  plugins: [],
} satisfies Config;
