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
import { initAnalytics } from '@/lib/events';
import { swrFetcher } from '@/api/swrFetcher';

// Gated + tagged in lib/events.ts; a no-op when analytics is disabled.
initAnalytics();

ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
        <PostHogProvider client={posthog}>
            <TourProvider>
                <SWRConfig
                    value={{
                        revalidateOnFocus: false,
                        shouldRetryOnError: false,
                        fetcher: swrFetcher
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
