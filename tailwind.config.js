/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // Rất quan trọng: phải quét file index.html và tất cả file trong thư mục src
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}