import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server:{
    proxy: {
      '/api': {
        target: "https://safe-route-nm6k.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    }
  },
});
