import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Tailwind v4 runs as a Vite plugin — there is no postcss.config.js and no
  // tailwind.config.js. Theme and content scanning are configured from CSS
  // (see the @theme block at the top of src/index.css).
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
