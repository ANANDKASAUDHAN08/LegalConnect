/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts,scss,css}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E293B', // Deep Slate
          dark: '#0F172A',
          light: '#334155',
        },
        accent: {
          DEFAULT: '#D97706', // Modern Gold
          dark: '#B45309',
          light: '#F59E0B',
        },
        success: {
          DEFAULT: '#059669', // Forest Green
          light: '#10B981',
        },
        background: {
          light: '#F8FAFC', // Soft Snow
          dark: '#0F172A',  // Midnight
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E293B',
        },
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e8c96d',
          700: '#a68b3d',
        },
        // Auth-specific mappings to CSS variables
        authAccent: 'var(--color-accent)',
        authAccentLight: 'var(--color-accent-light)',
        bgSurface: 'var(--bg-surface)',
        bgElevated: 'var(--bg-elevated)',
        bgBase: 'var(--bg-base)',
        borderSubtle: 'var(--border-subtle)',
        textPrimary: 'var(--text-primary)',
        textMuted: 'var(--text-muted)',
        textSecondary: 'var(--text-secondary)',
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '20px',
        '2xl': '32px',
        'auth': 'var(--radius-md)',
      },
      boxShadow: {
        'card-flat': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card-elevated': '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
        'modal': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      }
    },
  },
  plugins: [],
}