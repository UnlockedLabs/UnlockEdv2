import axios from "axios";
axios.defaults.withCredentials = true;
const env = import.meta.env.VITE_APP_ENV ?? "development";
if (env !== "production" && env !== "prod") {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}
window.axios = axios;
