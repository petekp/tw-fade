/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./demo/**/*.html'],
  theme: {
    extend: {},
  },
  plugins: [require('./src')],
}
