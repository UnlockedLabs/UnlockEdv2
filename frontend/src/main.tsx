import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './css/app.css';
import { SWRConfig } from 'swr';
import { ThemeProvider } from './Components/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <SWRConfig
            value={{
                fetcher: (url) => window.axios.get(url).then((res) => res.data)
            }}
        >
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </SWRConfig>
    </React.StrictMode>
);
