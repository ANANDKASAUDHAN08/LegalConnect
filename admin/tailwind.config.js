/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary, #0a0e1a)',
        'bg-secondary': 'var(--bg-secondary, #111827)',
        'bg-tertiary': 'var(--bg-tertiary, #1a2235)',
        'bg-card': 'var(--bg-card, rgba(17, 24, 39, 0.7))',
        'accent-primary': 'var(--accent-primary, #6366f1)',
        'accent-secondary': 'var(--accent-secondary, #06b6d4)',
        'accent-success': 'var(--accent-success, #10b981)',
        'accent-warning': 'var(--accent-warning, #f59e0b)',
        'accent-danger': 'var(--accent-danger, #ef4444)',
        'text-primary': 'var(--text-primary, #f1f5f9)',
        'text-secondary': 'var(--text-secondary, #94a3b8)',
        'text-tertiary': 'var(--text-tertiary, #64748b)'
      },
      borderRadius: {
        'glass-sm': 'var(--radius-sm, 6px)',
        'glass-md': 'var(--radius-md, 12px)',
        'glass-lg': 'var(--radius-lg, 16px)',
        'glass-xl': 'var(--radius-xl, 24px)'
      }
    },
  },
  plugins: [],
}