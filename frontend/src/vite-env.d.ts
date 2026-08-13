/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PUBLIC_POSTHOG_KEY: string;
    readonly VITE_PUBLIC_POSTHOG_HOST: string;
    /** 'production' | 'development' — set per deployment at image build time. Blank locally, which disables analytics. */
    readonly VITE_DEPLOYMENT: string;
    /** Deployment identity: 'stlouis' | 'maine' | 'alaska' | 'mocode' | 'demo' | 'staging'. */
    readonly VITE_STATE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
