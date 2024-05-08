import axios from "axios";
axios.defaults.withCredentials = true;
axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
const env = import.meta.env.VITE_APP_ENV ?? "development";
if (env !== "production" && env !== "prod") {
  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;
}
window.axios = axios;
