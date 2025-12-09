import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: This ensures assets work on GitHub Pages (e.g. user.github.io/repo-name/)
  base: './', 
  define: {
    // Polyfill for process.env to prevent crashes in some libraries
    'process.env': {}
  }
});