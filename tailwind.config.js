/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-primary': 'var(--brand-primary)',
        'brand-ai': 'var(--brand-ai)',
        surface: 'var(--surface)',
        'simulation-bg': 'var(--simulation-bg)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
    },
  },
  plugins: [],
};
