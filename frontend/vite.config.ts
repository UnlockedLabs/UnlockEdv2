import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') }
    },
    optimizeDeps: {
        exclude: ['posthog-js', 'posthog-js/react']
    },
    server: {
        host: '0.0.0.0',
        port: 5173
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        return id
                            .toString()
                            .split('node_modules/')[1]
                            .split('/')[0]
                            .toString();
                    }
                }
            }
        }
    }
});
