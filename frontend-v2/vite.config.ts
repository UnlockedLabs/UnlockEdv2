import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

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
        port: 5173,
        allowedHosts: ['frontend']
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('@radix-ui')) return 'radix';
                        if (id.includes('recharts')) return 'recharts';
                        if (id.includes('react-router')) return 'router';
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
