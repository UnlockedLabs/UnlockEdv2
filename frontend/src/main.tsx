import React from 'react';
import ReactDOM from 'react-dom/client';
import { SWRConfig } from 'swr';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TourProvider } from '@/contexts/TourContext';
import App from '@/App';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/styles/globals.css';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// Initialize PostHog — wrapped so a missing key never crashes the app.
try {
    posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        defaults: '2026-01-30',
        capture_exceptions: true
    });
} catch {
    // Missing/invalid config — app runs without analytics.
}

ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
        <PostHogProvider client={posthog}>
            <TourProvider>
                <SWRConfig
                    value={{
                        revalidateOnFocus: false,
                        shouldRetryOnError: false,
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
                                const error = new Error(res.statusText);
                                throw error;
                            }
                            return res.json() as Promise<unknown>;
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
