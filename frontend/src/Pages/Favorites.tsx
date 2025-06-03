import useSWR from 'swr';
import { OpenContentItem, ServerResponseMany, ViewType } from '@/common';
import Pagination from '@/Components/Pagination';
import FavoriteCard from '@/Components/FavoriteCard';
import { isAdministrator, useAuth } from '@/useAuth';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import { useOutletContext } from 'react-router-dom';

export default function FavoritesPage() {
    const { user } = useAuth();
    const { activeView, searchTerm, sortQuery } = useOutletContext<{
        activeView: ViewType;
        searchTerm: string;
        sortQuery: string;
    }>();
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const { data, error, mutate, isLoading } = useSWR<
        ServerResponseMany<OpenContentItem>,
        Error
    >(
        user
            ? `/api/open-content/favorites?page=${pageQuery}&per_page=${perPage}&search=${searchTerm}&order_by=${sortQuery}`
            : null,
        { shouldRetryOnError: false }
    );
    const favorites = data?.data ?? [];
    const meta = data?.meta;

    return (
        <>
            <div
                className={`mt-4 ${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
            >
                {favorites.map((favorite) => (
                    <FavoriteCard
                        key={`${favorite.open_content_provider_id}-${favorite.content_id}-${favorite.title}`}
                        pageQuery={pageQuery}
                        perPage={perPage}
                        favorite={favorite}
                        mutate={mutate}
                        isAdminInStudentView={isAdministrator(user)}
                        view={activeView}
                    />
                ))}
            </div>
            {isLoading && <p>Loading...</p>}
            {error && (
                <p className="text-error">
                    Failed to load favorites: {error.message}
                </p>
            )}
            {!isLoading && !error && favorites.length === 0 && (
                <h2>No favorites found.</h2>
            )}
            {!isLoading && !error && meta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={setPerPage}
                    />
                </div>
            )}
        </>
    );
}
