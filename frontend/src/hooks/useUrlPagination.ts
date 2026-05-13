import { useSearchParams } from 'react-router-dom';

export function useUrlPagination(defaultPage = 1, defaultPerPage = 20, prefix = '') {
    const [searchParams, setSearchParams] = useSearchParams();

    const pageKey = prefix ? `${prefix}_page` : 'page';
    const perPageKey = prefix ? `${prefix}_per_page` : 'per_page';

    const page = parseInt(
        searchParams.get(pageKey) ?? defaultPage.toString(),
        10
    );
    const perPage = parseInt(
        searchParams.get(perPageKey) ?? defaultPerPage.toString(),
        10
    );

    const setPage = (newPage: number, options?: { replace?: boolean }) => {
        const params = new URLSearchParams(searchParams);
        params.set(pageKey, newPage.toString());
        setSearchParams(params, { replace: options?.replace ?? false });
    };

    const setPerPage = (newPerPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set(perPageKey, newPerPage.toString());
        params.set(pageKey, '1');
        setSearchParams(params, { replace: false });
    };

    return { page, perPage, setPage, setPerPage };
}
