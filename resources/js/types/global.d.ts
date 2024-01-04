import { AxiosInstance } from "axios";
import ziggyRoute, { Config as ZiggyConfig } from "ziggy-js";

declare global {
    interface Window {
        axios: AxiosInstance;
    }

    interface HTMLDialogElement {
        showModal: () => void;
    }

    var route: typeof ziggyRoute;
    var Ziggy: ZiggyConfig;
}
