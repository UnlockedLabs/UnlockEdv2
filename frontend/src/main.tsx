import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app';
import '@/css/app.css';
import { SWRConfig } from 'swr';
import { ThemeProvider } from '@/Context/ThemeContext';

ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
        <SWRConfig
            value={{
                // eslint-disable-next-line
                fetcher: (url) => window.axios.get(url).then((res) => res.data)
            }}
        >
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </SWRConfig>
    </React.StrictMode>
);
