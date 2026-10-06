import { defineConfig, loadEnv, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/**
 * Production serves /config.js from a Kubernetes ConfigMap (EN-176); this
 * stands in for it locally so the app's window.__CONFIG__ read works the same
 * way in dev. Built from the same VITE_* vars docker-compose/.env already
 * provide, via loadEnv (merges .env files with real process.env, real env
 * winning), so `.env` keeps working for a developer testing PostHog locally.
 */
function devConfigJs(env: Record<string, string>): Plugin {
    return {
        name: 'dev-config-js',
        configureServer(server) {
            server.middlewares.use('/config.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.end(
                    `window.__CONFIG__ = ${JSON.stringify({
                        deployment: env.VITE_DEPLOYMENT ?? '',
                        state: env.VITE_STATE ?? '',
                        posthogKey: env.VITE_PUBLIC_POSTHOG_KEY ?? '',
                        posthogHost: env.VITE_PUBLIC_POSTHOG_HOST ?? ''
                    })};`
                );
            });
        }
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    return {
        plugins: [tailwindcss(), react(), devConfigJs(env)],
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
    };
});
