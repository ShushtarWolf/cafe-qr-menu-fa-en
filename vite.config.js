import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5361,
    proxy: {
      '/api': 'http://localhost:5360',
      '/m': 'http://localhost:5360',
      '/media': 'http://localhost:5360',
      '/uploads': 'http://localhost:5360'
    }
  }
});
