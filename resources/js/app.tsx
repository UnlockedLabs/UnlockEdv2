import "./bootstrap";
import "../css/app.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { createInertiaApp } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { SWRConfig } from "swr";

const appName = import.meta.env.VITE_APP_NAME || "Laravel";

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob("./Pages/**/*.tsx"),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <React.StrictMode>
                <SWRConfig
                    value={{
                        fetcher: (url) =>
                            window.axios.get(url).then((res) => res.data),
                    }}
                >
                    <main>
                        <App {...props} />
                    </main>
                </SWRConfig>
            </React.StrictMode>,
        );
    },
    progress: {
        color: "#4B5563",
    },
});
