/**
 * Runtime config, loaded via the /config.js script tag in index.html before
 * main.tsx runs. In production it's rendered from a Kubernetes ConfigMap; in
 * dev it's served by the Vite plugin in vite.config.ts from .env values.
 *
 * Exported (rather than left as an ambient type in vite-env.d.ts) so
 * vite.config.ts's dev plugin can import it too — the dev server's response
 * and the app's read of window.__CONFIG__ are two copies of the same shape,
 * and this is the one thing that can type-link them (the Helm ConfigMap
 * template is a third copy that genuinely can't be — different runtime).
 */
export interface AppRuntimeConfig {
    /** 'production' | 'development' | 'local' — blank disables analytics; 'local' sends deliberately from a dev machine. */
    readonly deployment: string;
    /** Deployment identity: 'stlouis' | 'maine' | 'alaska' | 'mocode' | 'demo' | 'staging'. */
    readonly state: string;
    readonly posthogKey: string;
    readonly posthogHost: string;
}

declare global {
    interface Window {
        /** Optional because a failed/missing config.js load must not crash the app. */
        __CONFIG__?: AppRuntimeConfig;
    }
}
