import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./css/app.css";
import { SWRConfig } from "swr";
import { AuthProvider } from "./AuthContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SWRConfig
      value={{
        fetcher: (url) => window.axios.get(url).then((res) => res.data),
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </SWRConfig>
  </React.StrictMode>,
);
