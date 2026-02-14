import React from 'react';
import ReactDOM from 'react-dom/client';
import { SWRConfig } from 'swr';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TourProvider } from '@/contexts/TourContext';
import App from '@/App';
import '@/styles/globals.css';

ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
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
                        return res.json();
                    }
                }}
            >
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </SWRConfig>
        </TourProvider>
    </React.StrictMode>
);
