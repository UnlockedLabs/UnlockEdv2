import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app';
import '@/css/app.css';
import { SWRConfig } from 'swr';
import { ThemeProvider } from '@/Context/ThemeContext';
import { TourProvider } from './Context/TourContext';

ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
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
    </React.StrictMode>
);
