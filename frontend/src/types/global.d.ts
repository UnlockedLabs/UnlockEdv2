import { AxiosInstance } from "axios";

declare global {
  interface Window {
    axios: AxiosInstance;
  }

  interface HTMLDialogElement {
    showModal: () => void;
  }
}
