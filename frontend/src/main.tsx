import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app';
import '@/css/app.css';
import { SWRConfig } from 'swr';
import { ThemeProvider } from '@/Context/ThemeContext';
import { TourProvider } from './Context/TourContext';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string;

if (!posthogKey) {
    console.warn(
        'VITE_PUBLIC_POSTHOG_KEY is not set. PostHog will not be initialized.'
    );
} else {
    posthog.init(posthogKey, {
        api_host: posthogHost,
        defaults: '2025-05-24'
    });
}

ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
        <PostHogProvider client={posthog}>
            <TourProvider>
                <SWRConfig
                    value={{
                        fetcher: async (url: string) => {
                            const res = await fetch(url, {
                                credentials: 'include',
                                headers: {
                                    'X-Requested-With': 'XMLHttpRequest',
                                    Accept: 'application/json',
                                    'Content-Type': 'application/json'
                                }
                            });

                            if (!res.ok) {
                                const error = new Error(
                                    'An error occurred while fetching the data'
                                );
                                error.message = res.statusText;
                                throw error;
                            }
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                            return res.json();
                        }
                    }}
                >
                    <ThemeProvider>
                        <App />
                    </ThemeProvider>
                </SWRConfig>
            </TourProvider>
        </PostHogProvider>
    </React.StrictMode>
);
