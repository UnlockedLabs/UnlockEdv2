import { useState } from 'react';
import useSWR from 'swr';
import { OpenContentFavorite, ServerResponseMany } from '@/common';
import Pagination from '@/Components/Pagination';
import { AxiosError } from 'axios';
import FavoriteCard from '@/Components/FavoriteCard';
import { useAuth } from '@/useAuth';

export default function FavoritesPage() {
    const { user } = useAuth();
    const [perPage, setPerPage] = useState(12);
    const [pageQuery, setPageQuery] = useState(1);

    const { data, error, isLoading } = useSWR<
        ServerResponseMany<OpenContentFavorite>,
        AxiosError
    >(
        user
            ? `/api/open-content/favorites?page=${pageQuery}&per_page=${perPage}`
            : null,
        { shouldRetryOnError: false }
    );

    const favorites = data?.data ?? [];
    const meta = data?.meta;

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
    };

    return (
        <div className="  p-8 ">
            <h1>My Favorites</h1>
            <div className="grid grid-cols-4 gap-6">
                {favorites.map((favorite) => (
                    <FavoriteCard
                        key={favorite.content_id}
                        pageQuery={pageQuery}
                        perPage={perPage}
                        favorite={favorite}
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
                <p>No favorites found.</p>
            )}
            {!isLoading && !error && meta && (
                <div className="flex justify-center mt-4">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={handleSetPerPage}
                    />
                </div>
            )}
        </div>
    );
}
