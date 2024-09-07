import axios, { AxiosResponse } from 'axios';
axios.defaults.withCredentials = true;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

import { ServerResponse } from '@/common';

class API {
    public static unauthorized: ServerResponse<null> = {
        success: false,
        data: null,
        message: 'Unauthorized'
    };

    private static getReturnData<T>(resp: AxiosResponse): ServerResponse<T> {
        switch (resp.status) {
            case 200:
            case 201:
                if (resp.data) {
                    const respData = resp.data as ServerResponse<T>;
                    return {
                        success: true,
                        data: respData.data,
                        message: resp.data.message,
                        meta: resp.data.meta
                    };
                } else {
                    return {
                        success: true,
                        data: null,
                        message: 'Successfully submitted'
                    };
                }
            case 401:
            case 403:
                return API.unauthorized;
            default:
                return {
                    success: false,
                    data: null,
                    message: resp.data.message ?? 'Error retrieving data'
                };
        }
    }

    public static async get<T>(url: string): Promise<ServerResponse<T>> {
        try {
            const resp = await axios.get('/api/' + url);
            return API.getReturnData<T>(resp);
        } catch (error) {
            return {
                success: false,
                data: null,
                message: error.data.message ?? 'Error retrieving data'
            };
        }
    }

    public static async post<T>(
        url: string,
        data: any
    ): Promise<ServerResponse<T>> {
        try {
            const resp = await axios.post('/api/' + url, data);
            return API.getReturnData<T>(resp);
        } catch (error) {
            return {
                success: false,
                data: null,
                message: error.data.message ?? 'Error submitting data'
            };
        }
    }

    public static async put<T>(
        url: string,
        data: any
    ): Promise<ServerResponse<T>> {
        try {
            const resp = await axios.put('/api/' + url, data);
            return API.getReturnData<T>(resp);
        } catch (error) {
            return {
                success: false,
                data: null,
                message: error.data.message ?? 'Error updating data'
            };
        }
    }

    public static async patch<T>(
        url: string,
        data: any
    ): Promise<ServerResponse<T>> {
        try {
            const resp = await axios.patch('/api/' + url, data);
            return API.getReturnData<T>(resp);
        } catch (error) {
            return {
                success: false,
                data: null,
                message: error.data.message ?? 'Error updating data'
            };
        }
    }

    public static async delete<T>(url: string): Promise<ServerResponse<T>> {
        try {
            const resp = await axios.delete('/api/' + url);
            switch (resp.status) {
                case 204:
                case 200:
                case 201:
                    if (resp.data) {
                        const respData = resp.data as ServerResponse<T>;
                        return {
                            success: true,
                            data: respData.data,
                            message: resp.data.message
                        };
                    } else {
                        return {
                            success: true,
                            data: null,
                            message: 'Successfully submitted'
                        };
                    }
                case 401:
                case 403:
                    return API.unauthorized;
                default:
                    return {
                        success: false,
                        data: null,
                        message: resp.data.message ?? 'Error deleting data'
                    };
            }
        } catch (error) {
            return {
                success: false,
                data: null,
                message: error.data.message ?? 'Error deleting data'
            };
        }
    }
}

export default API;
