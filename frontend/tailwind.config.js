/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        industrial: {
          bg: '#0F172A',
          green: '#22C55E',
          red: '#EF4444',
          blue: '#3B82F6',
          amber: '#F59E0B',
          light: '#E5E7EB',
          gray: '#6B7280',
          dark: '#374151',
          card: '#1E293B'
        }
      },
      borderRadius: {
        DEFAULT: '2px',
        none: '0px',
        sm: '1px',
        md: '2px',
        lg: '3px',
      }
    },
  },
  plugins: [],
}
