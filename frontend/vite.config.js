import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8765';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
      },
      '/ws': {
        target: BACKEND.replace(/^http/, 'ws'),
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
