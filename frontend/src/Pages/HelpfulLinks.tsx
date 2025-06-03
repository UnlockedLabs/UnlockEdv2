import {
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseOne,
    UserRole,
    ViewType
} from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import Pagination from '@/Components/Pagination';
import { useEffect } from 'react';
import useSWR from 'swr';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import { useOutletContext } from 'react-router-dom';

export default function HelpfulLinks() {
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

    const {
        data: helpfulLinks,
        mutate: mutateHelpfulFavs,
        isLoading,
        error
    } = useSWR<ServerResponseOne<HelpfulLinkAndSort>, Error>(
        `/api/helpful-links?page=${pageQuery}&per_page=${perPage}&search=${searchTerm}${sortQuery}`
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

    useEffect(() => {
        setPageQuery(1);
    }, [searchTerm]);

    return (
        <>
            <div
                className={`${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
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
