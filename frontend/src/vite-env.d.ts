/// <reference types="vite/client" />

// Window.__CONFIG__'s shape lives in src/lib/runtimeConfig.ts, not here — it's
// an app contract that vite.config.ts also needs to import, not Vite's own
// client typing (what this file is for).
