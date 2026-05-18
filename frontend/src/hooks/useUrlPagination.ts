import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useUrlPagination(defaultPage = 1, defaultPerPage = 20, prefix = '') {
    const [searchParams, setSearchParams] = useSearchParams();

    const pageKey = prefix ? `${prefix}_page` : 'page';
    const perPageKey = prefix ? `${prefix}_per_page` : 'per_page';

    const parsedPage = parseInt(searchParams.get(pageKey) ?? '', 10);
    const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : defaultPage;

    const parsedPerPage = parseInt(searchParams.get(perPageKey) ?? '', 10);
    const perPage = Number.isFinite(parsedPerPage) && parsedPerPage >= 1 ? parsedPerPage : defaultPerPage;

    const setPage = useCallback(
        (newPage: number, options?: { replace?: boolean }) => {
            const params = new URLSearchParams(searchParams);
            params.set(pageKey, newPage.toString());
            setSearchParams(params, { replace: options?.replace ?? false });
        },
        [searchParams, setSearchParams, pageKey]
    );

    const setPerPage = useCallback(
        (newPerPage: number) => {
            const params = new URLSearchParams(searchParams);
            params.set(perPageKey, newPerPage.toString());
            params.set(pageKey, '1');
            setSearchParams(params, { replace: false });
        },
        [searchParams, setSearchParams, pageKey, perPageKey]
    );

    return { page, perPage, setPage, setPerPage };
}
