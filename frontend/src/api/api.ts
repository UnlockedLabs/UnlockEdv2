import { ServerResponse, ServerResponseMany } from '@/common';

class API {
    private static defaultHeaders: HeadersInit = {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
        'Content-Type': 'application/json'
    };

    private static async fetchWithHandling<T>(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url: string,
        body?: unknown
    ): Promise<ServerResponse<T>> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch('/api/' + url, {
                method,
                headers: API.defaultHeaders,
                credentials: 'include',
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (resp.status === 204 || resp.status === 205) {
                return {
                    type: 'one',
                    success: true,
                    message: 'Request successful',
                    data: {} as T,
                    status: resp.status
                };
            }
            const contentType = resp.headers.get('Content-Type') ?? '';
            const responseHeaders: Record<string, string> = {};
            resp.headers.forEach((val, key) => {
                responseHeaders[key] = val;
            });
            let data: ServerResponse<T>;

            const raw = await resp.text();

            if (contentType.includes('application/json') && raw) {
                try {
                    data = JSON.parse(raw) as ServerResponse<T>;
                } catch {
                    data = {
                        type: 'one',
                        message: raw,
                        data: {} as T,
                        success: false,
                        status: resp.status,
                        headers: responseHeaders
                    };
                }
            } else {
                data = {
                    type: 'one',
                    message: raw,
                    data: {} as T,
                    success: false,
                    status: resp.status,
                    headers: responseHeaders
                };
            }
            if (!resp.ok) {
                let message = 'An error occurred';
                if (resp.status === 401 || resp.status === 403) {
                    message = 'Unauthorized';
                } else if (data?.message) {
                    message = data.message;
                }

                const error = new Error(message) as Error & {
                    response: ServerResponse<null>;
                };
                error.response = {
                    type: 'one',
                    success: false,
                    data: null,
                    message,
                    status: resp.status,
                    headers: responseHeaders
                };
                throw error;
            }

            return API.getReturnData<T>(data, resp.status);
        } catch (err) {
            const error = err as Error & {
                response?: ServerResponse<null>;
            };
            const errCode = error.response?.status;
            return {
                type: 'one',
                success: false,
                message: error.message || 'An error occurred',
                data: {} as T,
                status: errCode ?? 0,
                headers: error.response?.headers ?? {}
            };
        }
    }

    private static getReturnData<T>(
        respData: ServerResponse<T>,
        status?: number
    ): ServerResponse<T> {
        if (Array.isArray(respData.data)) {
            const manyResp = respData as ServerResponseMany<T>;
            return {
                type: 'many',
                success: true,
                data: manyResp.data,
                message: manyResp.message ?? 'Request successful',
                meta: manyResp.meta ?? {
                    total: 0,
                    current_page: 1,
                    last_page: 1,
                    per_page: manyResp.data.length
                },
                status: status
            };
        } else {
            return {
                type: 'one',
                success: true,
                data: respData.data,
                message: respData.message ?? 'Request successful',
                status: status
            };
        }
    }

    public static get<T>(url: string): Promise<ServerResponse<T>> {
        return API.fetchWithHandling<T>('GET', url);
    }

    public static post<T, D>(url: string, data: D): Promise<ServerResponse<T>> {
        return API.fetchWithHandling<T>('POST', url, data);
    }

    public static put<T, D>(url: string, data: D): Promise<ServerResponse<T>> {
        return API.fetchWithHandling<T>('PUT', url, data);
    }

    public static patch<T, D>(
        url: string,
        data: D
    ): Promise<ServerResponse<T>> {
        return API.fetchWithHandling<T>('PATCH', url, data);
    }

    public static delete<T>(url: string): Promise<ServerResponse<T>> {
        return API.fetchWithHandling<T>('DELETE', url);
    }

    public static async downloadFile(
        url: string
    ): Promise<{ blob: Blob; headers: Headers }> {
        const resp = await fetch('/api/' + url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!resp.ok) {
            throw new Error(`Failed to download file: ${resp.statusText}`);
        }

        const blob = await resp.blob();
        return { blob, headers: resp.headers };
    }
}

export default API;
