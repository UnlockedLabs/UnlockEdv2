import { useCallback, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export function useUrlPagination(defaultPage = 1, defaultPerPage = 20, prefix = '') {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const pageKey = prefix ? `${prefix}_page` : 'page';
    const perPageKey = prefix ? `${prefix}_per_page` : 'per_page';

    const parsedPage = parseInt(searchParams.get(pageKey) ?? '', 10);
    const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : defaultPage;

    const parsedPerPage = parseInt(searchParams.get(perPageKey) ?? '', 10);
    const perPage = Number.isFinite(parsedPerPage) && parsedPerPage >= 1 ? parsedPerPage : defaultPerPage;

    const searchRef = useRef(location.search);
    searchRef.current = location.search;

    const setPage = useCallback(
        (newPage: number, options?: { replace?: boolean }) => {
            const params = new URLSearchParams(searchRef.current);
            params.set(pageKey, newPage.toString());
            navigate(
                { search: params.toString() },
                { replace: options?.replace ?? false }
            );
        },
        [navigate, pageKey]
    );

    const setPerPage = useCallback(
        (newPerPage: number) => {
            const params = new URLSearchParams(searchRef.current);
            params.set(perPageKey, newPerPage.toString());
            params.set(pageKey, '1');
            navigate({ search: params.toString() }, { replace: false });
        },
        [navigate, pageKey, perPageKey]
    );

    return { page, perPage, setPage, setPerPage };
}
