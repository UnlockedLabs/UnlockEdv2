import axios, { AxiosResponse } from 'axios';
import { ServerResponse } from '@/common';

axios.defaults.withCredentials = true;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

const unauthorized: ServerResponse<null> = {
    success: false,
    data: null,
    message: 'Unauthorized'
};

axios.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
            return Promise.reject(unauthorized);
        }
        return Promise.reject({
            success: false,
            message: error?.response?.data?.message ?? 'An error occurred',
            data: null
        });
    }
);

class API {
    private static getReturnData<T>(resp: AxiosResponse): ServerResponse<T> {
        const respData = resp.data as ServerResponse<T>;
        return {
            success: true,
            data: respData.data,
            message: resp.data.message ?? 'Request successful',
            meta: resp.data.meta
        };
    }

    public static async request<T>(
        method: 'get' | 'post' | 'put' | 'patch' | 'delete',
        url: string,
        data?: Record<string, unknown>
    ): Promise<ServerResponse<T>> {
        try {
            const resp = await axios({
                method,
                url: '/api/' + url,
                data
            });
            return API.getReturnData<T>(resp);
        } catch (error) {
            return error;
        }
    }

    public static get<T>(url: string): Promise<ServerResponse<T>> {
        return API.request<T>('get', url);
    }

    public static post<T>(
        url: string,
        data: Record<string, unknown>
    ): Promise<ServerResponse<T>> {
        return API.request<T>('post', url, data);
    }

    public static put<T>(
        url: string,
        data: Record<string, unknown>
    ): Promise<ServerResponse<T>> {
        return API.request<T>('put', url, data);
    }

    public static patch<T>(
        url: string,
        data: Record<string, unknown>
    ): Promise<ServerResponse<T>> {
        return API.request<T>('patch', url, data);
    }

    public static delete<T>(url: string): Promise<ServerResponse<T>> {
        return API.request<T>('delete', url);
    }
}

export default API;
