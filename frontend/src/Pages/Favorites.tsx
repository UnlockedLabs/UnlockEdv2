import { useState } from 'react';
import useSWR from 'swr';
import {
    FilterLibrariesVidsandHelpfulLinksResident,
    OpenContentItem,
    ServerResponseMany
} from '@/common';
import Pagination from '@/Components/Pagination';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { useDebounceValue } from 'usehooks-ts';
import { AxiosError } from 'axios';
import FavoriteCard from '@/Components/FavoriteCard';
import { isAdministrator, useAuth } from '@/useAuth';

export default function FavoritesPage() {
    const { user } = useAuth();
    const [perPage, setPerPage] = useState(12);
    const [pageQuery, setPageQuery] = useState(1);
    const [searchTerm, setSearchTerm] = useState<string>('');

    const searchQuery = useDebounceValue(searchTerm, 500);
    const [sortQuery, setSortQuery] = useState<string>(
        FilterLibrariesVidsandHelpfulLinksResident['Title (A to Z)']
    );

    const { data, error, mutate, isLoading } = useSWR<
        ServerResponseMany<OpenContentItem>,
        AxiosError
    >(
        user
            ? `/api/open-content/favorites?page=${pageQuery}&per_page=${perPage}&search=${searchQuery[0]}${sortQuery}`
            : null,
        { shouldRetryOnError: false }
    );
    const favorites = data?.data ?? [];
    const meta = data?.meta;

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
    };
    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
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
            </div>
            <div className="grid grid-cols-4 gap-6">
                {favorites.map((favorite) => (
                    <FavoriteCard
                        key={`${favorite.open_content_provider_id}-${favorite.content_id}-${favorite.title}`}
                        pageQuery={pageQuery}
                        perPage={perPage}
                        favorite={favorite}
                        mutate={mutate}
                        isAdminInStudentView={isAdministrator(user)}
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
                        setPerPage={handleSetPerPage}
                    />
                </div>
            )}
        </>
    );
}
