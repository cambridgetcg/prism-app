/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // PRISM brand colors
        prism: {
          bg: '#0a0a0f',
          'bg-secondary': '#12121a',
          'bg-tertiary': '#1a1a24',
          border: '#2a2a3a',
          text: '#e0e0e8',
          'text-muted': '#8a8a9a',
          accent: '#6366f1',
          'accent-hover': '#818cf8',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
        // Price change colors
        change: {
          positive: '#10b981',
          negative: '#ef4444',
          neutral: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'stat-value': ['2rem', { lineHeight: '1.2', fontWeight: '600' }],
        'stat-label': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      boxShadow: {
        'prism': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'prism-hover': '0 8px 30px rgba(99, 102, 241, 0.15)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'prism-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)',
        'card-gradient': 'linear-gradient(145deg, #1a1a24 0%, #12121a 100%)',
      },
    },
  },
  plugins: [],
};
