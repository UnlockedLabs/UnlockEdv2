import { startTransition, useState } from 'react';
import useSWR from 'swr';
import {
    FilterLibrariesVidsandHelpfulLinksResident,
    OpenContentItem,
    ServerResponseMany,
    ViewType
} from '@/common';
import Pagination from '@/Components/Pagination';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import FavoriteCard from '@/Components/FavoriteCard';
import { isAdministrator, useAuth } from '@/useAuth';
import ToggleView from '@/Components/ToggleView';
import { useSessionViewType } from '@/Hooks/sessionView';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';

export default function FavoritesPage() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [activeView, setActiveView] = useSessionViewType('favoritesView');
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);
    const [sortQuery, setSortQuery] = useState<string>(
        FilterLibrariesVidsandHelpfulLinksResident['Title (A to Z)']
    );

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

    const handleChange = (newSearch: string) => {
        startTransition(() => {
            setSearchTerm(encodeURIComponent(newSearch));
        });
        setPageQuery(1);
    };
    return (
        <>
            <div className="flex flex-row justify-between">
                {/* TO DO: make this a common enum? */}
                <div className="flex flex-row gap-2 items-center">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleChange}
                    />
                    <DropdownControl
                        label="Order by"
                        setState={setSortQuery}
                        enumType={FilterLibrariesVidsandHelpfulLinksResident}
                    />
                </div>
                <div className="ml-auto">
                    <ToggleView
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                </div>
            </div>
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
