import { json, LoaderFunction } from 'react-router-dom';
import { OpenContentProvider, ServerResponseMany } from './common';
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
