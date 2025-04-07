import { useSearchParams } from 'react-router-dom';

export function useUrlPagination(defaultPage = 1, defaultPerPage = 20) {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = parseInt(
        searchParams.get('page') ?? defaultPage.toString(),
        10
    );
    const perPage = parseInt(
        searchParams.get('per_page') ?? defaultPerPage.toString(),
        10
    );

    const setPage = (newPage: number, options?: { replace?: boolean }) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', newPage.toString());
        setSearchParams(params, { replace: options?.replace ?? false });
    };

    const setPerPage = (newPerPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set('per_page', newPerPage.toString());
        params.set('page', '1');
        setSearchParams(params, { replace: false });
    };

    return { page, perPage, setPage, setPerPage };
}
