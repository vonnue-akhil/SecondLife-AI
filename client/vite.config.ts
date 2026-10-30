import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${process.env.PORT || 3001}` },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
