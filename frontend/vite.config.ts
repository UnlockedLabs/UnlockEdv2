import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: { sourcemap: true }, // we keep the sourcemap for now, so we can debug in staging
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1',
                changeOrigin: true
            },
            '/self-service': {
                target: 'http://127.0.0.1',
                changeOrigin: true
            }
        }
    }
});
