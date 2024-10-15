import axios, { AxiosError, AxiosResponse } from 'axios';
import { ServerResponse, ServerResponseMany } from '@/common';

axios.defaults.withCredentials = true;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.headers.common.Accept = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

axios.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
            return Promise.reject(new Error('Unauthorized'));
        }
        const errorData = error.response?.data as ServerResponse<string>;
        return {
            success: false,
            message: errorData.message ?? 'An error occurred',
            data: undefined
        };
    }
);

class API {
    private static getReturnData<T>(resp: AxiosResponse): ServerResponse<T> {
        const respData = resp.data as ServerResponse<T>;
        if (Array.isArray(respData.data)) {
            const manyResp = respData as ServerResponseMany<T>;
            return {
                type: 'many',
                success: true,
                data: respData.data,
                message: respData.message ?? 'Request successful',
                meta: manyResp.meta ?? {
                    total: 0,
                    current_page: 1,
                    last_page: 1,
                    per_page: respData.data.length
                }
            };
        } else {
            return {
                type: 'one',
                success: true,
                data: respData.data,
                message: respData.message ?? 'Request successful'
            };
        }
    }

    public static async request<T>(
        method: 'get' | 'post' | 'put' | 'patch' | 'delete',
        url: string,
        data?: any // eslint-disable-line
    ): Promise<ServerResponse<T>> {
        try {
            const resp = await axios({
                method,
                url: '/api/' + url,
                data //eslint-disable-line
            });
            return API.getReturnData<T>(resp);
        } catch {
            return {
                type: 'one',
                success: false,
                message: 'An error occurred'
            } as ServerResponse<T>;
        }
    }

    public static get<T>(url: string): Promise<ServerResponse<T>> {
        return API.request<T>('get', url);
    }

    public static post<T>(
        url: string,
        data: any // eslint-disable-line
    ): Promise<ServerResponse<T>> {
        return API.request<T>('post', url, data);
    }

    public static put<T>(
        url: string,
        data: any // eslint-disable-line
    ): Promise<ServerResponse<T>> {
        return API.request<T>('put', url, data);
    }

    public static patch<T>(
        url: string,
        data: any // eslint-disable-line
    ): Promise<ServerResponse<T>> {
        return API.request<T>('patch', url, data);
    }

    public static delete<T>(url: string): Promise<ServerResponse<T>> {
        return API.request<T>('delete', url);
    }
}

export default API;
