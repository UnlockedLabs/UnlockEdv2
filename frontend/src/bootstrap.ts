import axios from "axios";
axios.defaults.withCredentials = true;
axios.defaults.proxy = {
  host: "localhost",
  port: 8080,
};
window.axios = axios;
