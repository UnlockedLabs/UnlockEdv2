import { json, LoaderFunction } from 'react-router-dom';
import { Library, ServerResponseMany } from './common';
import API from './api/api';

export const getRandomVisibleLibraries: LoaderFunction = async () => {
    const resp = (await API.get(
        `libraries?page=1&per_page=20&visibility=visible`
    )) as ServerResponseMany<Library>;
    if (resp.success) {
        resp.data.sort(() => Math.random() - 0.5);
        return json<Library[]>(resp.data.slice(0, 2));
    }
    return json<Library[]>([]);
};
