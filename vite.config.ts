import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Preserve the browser's Host so the Worker can verify the original same-origin request.
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } } } });
