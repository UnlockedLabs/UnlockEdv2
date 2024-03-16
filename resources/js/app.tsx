import "./bootstrap";
import "../css/app.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { createInertiaApp } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { SWRConfig } from "swr";
import axios from "axios";

const appName = import.meta.env.VITE_APP_NAME || "Laravel";

const errorPoster: any = (args: any, errType?: string) => {
    const appUrl = "http://localhost:9880/browser.log";

    let objSetup = `{"${errType}": ${JSON.stringify(args)}}`;
    let passableJson = JSON.parse(objSetup);

    axios.post(appUrl, passableJson).then((res) => {
        // We could do something here
    });
};

const cl = console.log;
const ci = console.info;
const cd = console.debug;
const cw = console.warn;
const ce = console.error;

if (window.console && console.log) {
    console.log = (...args) => {
        errorPoster(args.join(" "), "log");
        cl.apply(this, [...args]);
    };
}

if (window.console && console.info) {
    console.info = (...args) => {
        errorPoster(args.join(" "), "info");
        ci.apply(this, [...args]);
    };
}

if (window.console && console.debug) {
    console.debug = (...args) => {
        errorPoster(args.join(" "), "debug");
        cd.apply(this, [...args]);
    };
}

if (window.console && console.warn) {
    console.warn = (...args) => {
        errorPoster(args.join(" "), "warn");
        cw.apply(this, [...args]);
    };
}

if (window.console && console.error) {
    console.error = (...args) => {
        errorPoster(args, "error");
        ce.apply(this, [...args]);
    };
}

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
