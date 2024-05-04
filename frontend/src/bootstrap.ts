import axios from "axios";
window.axios = axios;
window.axios.defaults.headers.common["Content-Type"] = "application/json";
window.axios.defaults.headers.common["Accept"] = "application/json";
window.axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
window.axios.defaults.baseURL = `${import.meta.env.VITE_BACKEND_URL}`;
