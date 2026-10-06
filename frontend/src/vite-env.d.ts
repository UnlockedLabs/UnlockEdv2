/// <reference types="vite/client" />

/**
 * Runtime config, loaded via the /config.js script tag in index.html before
 * main.tsx runs. In production it's rendered from a Kubernetes ConfigMap; in
 * dev it's served by the Vite plugin in vite.config.ts from .env values.
 * Optional because a failed/missing config.js load must not crash the app.
 */
interface AppRuntimeConfig {
    /** 'production' | 'development' | 'local' — blank disables analytics; 'local' sends deliberately from a dev machine. */
    readonly deployment: string;
    /** Deployment identity: 'stlouis' | 'maine' | 'alaska' | 'mocode' | 'demo' | 'staging'. */
    readonly state: string;
    readonly posthogKey: string;
    readonly posthogHost: string;
}

interface Window {
    __CONFIG__?: AppRuntimeConfig;
}
