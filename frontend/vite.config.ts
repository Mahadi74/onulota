import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { ogTagsPlugin } from './src/plugins/ogTagsPlugin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ogTagsPlugin({ siteUrl: 'http://localhost:3000' })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
})
