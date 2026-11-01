/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          950: '#06130b',
          900: '#0a1e13',
          850: '#0e2619',
          800: '#133020',
          700: '#1c452e',
          600: '#276241',
        },
        wood: {
          950: '#1f1007',
          900: '#2b170a',
          800: '#422410',
          700: '#5a3116',
          600: '#75411e',
          500: '#945326',
          400: '#b86e35',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        neon: {
          green: '#22c55e',
          lime: '#4ade80',
        }
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'wood-rim': 'inset 0 1px 1px rgba(255, 255, 255, 0.25), 0 4px 12px rgba(0,0,0,0.6)',
        'felt-card': '0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.4)',
        'glow-gold': '0 0 15px rgba(245, 158, 11, 0.35)',
      }
    },
  },
  plugins: [],
};
