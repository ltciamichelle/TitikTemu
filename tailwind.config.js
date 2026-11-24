/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mint: 'var(--color-mint)',
        primary: 'var(--color-primary)',
        accent: 'var(--color-accent)',
        'main-road': 'var(--color-main-road)',
        'map-base': 'var(--color-map-base)',
        building: 'var(--color-building)',
        ink: 'var(--color-text)',
        muted: 'var(--color-muted)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        button: 'var(--radius-button)',
        pin: 'var(--radius-pin)',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(30, 42, 58, 0.10)',
        'soft-sm': '0 4px 14px rgba(30, 42, 58, 0.08)',
      },
    },
  },
  plugins: [],
};
