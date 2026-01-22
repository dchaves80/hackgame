/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cyber/HUD color palette
        cyber: {
          50: '#e6f7ff',
          100: '#b3e5ff',
          200: '#80d4ff',
          300: '#4dc2ff',
          400: '#1ab0ff',
          500: '#00a3ff', // primary cyan
          600: '#0082cc',
          700: '#006199',
          800: '#004166',
          900: '#002033',
        },
        dark: {
          950: '#030712', // casi negro
          900: '#0a0f1e', // fondo principal
          800: '#0f172a', // cards
          700: '#1e293b',
          600: '#334155',
        }
      },
      boxShadow: {
        'neon': '0 0 5px theme("colors.cyber.500"), 0 0 10px theme("colors.cyber.500")',
        'neon-sm': '0 0 3px theme("colors.cyber.500")',
        'neon-lg': '0 0 10px theme("colors.cyber.500"), 0 0 20px theme("colors.cyber.500")',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'draw-line': 'drawLine 0.5s ease-out forwards',
        'draw-vertical': 'drawVertical 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
      },
      keyframes: {
        scan: {
          '0%, 100%': { transform: 'translateY(-100%)' },
          '50%': { transform: 'translateY(100%)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        drawLine: {
          '0%': { width: '0%', opacity: '0' },
          '100%': { width: '100%', opacity: '1' },
        },
        drawVertical: {
          '0%': { height: '0', opacity: '0' },
          '100%': { height: '100%', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
