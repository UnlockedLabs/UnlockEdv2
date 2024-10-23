import { json, LoaderFunction } from 'react-router-dom';
import {
    Facility,
    OpenContentProvider,
    ServerResponse,
    ServerResponseMany
} from './common';
import API from './api/api';

export const getOpenContentProviders: LoaderFunction = async () => {
    const resp = (await API.get(
        `open-content`
    )) as ServerResponseMany<OpenContentProvider>;
    if (resp.success) {
        return json<OpenContentProvider[]>(resp.data);
    }
    return json<OpenContentProvider[]>([]);
};

export const getFacilities: LoaderFunction = async () => {
    const response: ServerResponse<Facility[]> =
        await API.get<Facility[]>(`facilities`);
    if (response.success) {
        return json<Facility[]>(response.data as Facility[]);
    }
    return json<null>(null);
};
