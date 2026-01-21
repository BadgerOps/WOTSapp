/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6eef5',
          100: '#c2d4e6',
          200: '#9ab8d6',
          300: '#729cc5',
          400: '#5486b8',
          500: '#3670ab',
          600: '#1e3a5f',
          700: '#1a3252',
          800: '#152a45',
          900: '#102238',
        },
        accent: {
          50: '#fff8e6',
          100: '#ffedb3',
          200: '#ffe180',
          300: '#ffd54d',
          400: '#ffcc26',
          500: '#ffc300',
          600: '#e6b000',
          700: '#cc9c00',
          800: '#b38900',
          900: '#997500',
        }
      }
    },
  },
  plugins: [],
}
