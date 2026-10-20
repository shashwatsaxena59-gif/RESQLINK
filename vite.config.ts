import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'leaflet', 'leaflet.markercluster', 'date-fns', 'sonner'],
  },
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split large vendor libs into separate cached chunks
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-leaflet': ['leaflet', 'leaflet.markercluster'],
          'vendor-ui': ['sonner', 'date-fns', 'clsx', 'tailwind-merge'],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-dropdown-menu',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
