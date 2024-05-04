import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './css/tailwind.css';
import { SWRConfig } from 'swr';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SWRConfig value={{ fetcher: (url) => window.axios.get(url).then((res) => res.data) }}></SWRConfig>
    <App />
  </React.StrictMode>
)
