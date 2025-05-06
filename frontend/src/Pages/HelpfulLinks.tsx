import {
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseOne,
    UserRole,
    FilterLibrariesVidsandHelpfulLinksResident,
    ViewType
} from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Pagination from '@/Components/Pagination';
import { useDebounceValue } from 'usehooks-ts';
import { useState } from 'react';
import useSWR from 'swr';
import ToggleView from '@/Components/ToggleView';
import { useSessionViewType } from '@/Hooks/sessionView';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';

export default function HelpfulLinks() {
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [activeView, setActiveView] = useSessionViewType('helpfulLinksView');
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const searchQuery = useDebounceValue(searchTerm, 500);
    const [sortQuery, setSortQuery] = useState<string>(
        FilterLibrariesVidsandHelpfulLinksResident['Title (A to Z)']
    );

    const {
        data: helpfulLinks,
        mutate: mutateHelpfulFavs,
        isLoading,
        error
    } = useSWR<ServerResponseOne<HelpfulLinkAndSort>, Error>(
        `/api/helpful-links?page=${pageQuery}&per_page=${perPage}&search=${searchQuery[0]}${sortQuery}`
    );
    function updateFavorites() {
        void mutateHelpfulFavs();
    }

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
                        setState={setSortQuery}
                        enumType={FilterLibrariesVidsandHelpfulLinksResident}
                    />
                </div>
                <div>
                    <ToggleView
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                </div>
            </div>

            <div
                className={`mt-4 ${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
            >
                {helpfulLinks?.data?.helpful_links.map((link: HelpfulLink) => (
                    <HelpfulLinkCard
                        key={link.id}
                        link={link}
                        mutate={updateFavorites}
                        role={UserRole.Student}
                        view={activeView}
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
                        setPerPage={setPerPage}
                    />
                </div>
            )}
        </>
    );
}
