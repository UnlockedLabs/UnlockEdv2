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
                    fetcher: (url) =>
                        // eslint-disable-next-line
                        window.axios.get(url).then((res) => res.data)
                }}
            >
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </SWRConfig>
        </TourProvider>
    </React.StrictMode>
);
