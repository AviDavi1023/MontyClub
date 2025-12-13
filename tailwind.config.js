module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f7fb',
          100: '#e9f0f7',
          200: '#d5e3ef',
          300: '#bcd2e4',
          400: '#98bad2', // light brand blue
          500: '#7ea4c1',
          600: '#5788b4', // mid brand blue
          700: '#2f5f88',
          800: '#184769',
          900: '#0b2a4a', // dark brand blue
        },
        accent: {
          blue: '#60a5fa',
          purple: '#a78bfa',
          pink: '#f472b6',
          orange: '#fb923c',
          green: '#4ade80',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 100%)',
      },
    },
  },
  plugins: [],
}


