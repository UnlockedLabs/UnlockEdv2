import {
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseOne,
    UserRole,
    FilterLibrariesVidsandHelpfulLinksResident
} from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Pagination from '@/Components/Pagination';
import { useDebounceValue } from 'usehooks-ts';
import { AxiosError } from 'axios';
import { useState } from 'react';
import useSWR from 'swr';

export default function HelpfulLinks() {
    const [perPage, setPerPage] = useState(20);
    const [searchTerm, setSearchTerm] = useState<string>('');

    const searchQuery = useDebounceValue(searchTerm, 500);
    const [sortQuery, setSortQuery] = useState<string>(
        FilterLibrariesVidsandHelpfulLinksResident['Title (A to Z)']
    );

    const [pageQuery, setPageQuery] = useState<number>(1);
    const {
        data: helpfulLinks,
        mutate: mutateHelpfulFavs,
        isLoading,
        error
    } = useSWR<ServerResponseOne<HelpfulLinkAndSort>, AxiosError>(
        `/api/helpful-links?page=${pageQuery}&per_page=${perPage}&search=${searchQuery[0]}${sortQuery}`
    );
    function updateFavorites() {
        void mutateHelpfulFavs();
    }
    const handleSetPerPage = (perPage: number) => {
        setPerPage(perPage);
        setPageQuery(1);
        updateFavorites();
    };
    const helpfulLinksMeta = helpfulLinks?.data?.meta ?? {
        total: 0,
        per_page: 20,
        page: 1,
        current_page: 1,
        last_page: 1
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
                        value={sortQuery}
                        setState={setSortQuery}
                        enumType={FilterLibrariesVidsandHelpfulLinksResident}
                    />
                </div>
            </div>
            <div className="grid grid-cols-4 gap-6">
                {helpfulLinks?.data?.helpful_links.map((link: HelpfulLink) => (
                    <HelpfulLinkCard
                        key={link.id}
                        link={link}
                        mutate={updateFavorites}
                        role={UserRole.Student}
                    />
                ))}
                {error && (
                    <span className="text-error">
                        Failed to load helpful links.
                    </span>
                )}
                {!isLoading &&
                    !error &&
                    helpfulLinks?.data.helpful_links.length === 0 && (
                        <span className="text-error">No results</span>
                    )}
            </div>
            {!isLoading && !error && helpfulLinksMeta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={helpfulLinksMeta}
                        setPage={setPageQuery}
                        setPerPage={handleSetPerPage}
                    />
                </div>
            )}
        </>
    );
}
