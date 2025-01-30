import {
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseOne,
    UserRole
} from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import Pagination from '@/Components/Pagination';
import { AxiosError } from 'axios';
import { useState } from 'react';
import useSWR from 'swr';

export default function HelpfulLinks() {
    const [perPage, setPerPage] = useState(20);
    const [pageQuery, setPageQuery] = useState<number>(1);
    const {
        data: helpfulLinks,
        mutate: mutateHelpfulFavs,
        isLoading,
        error
    } = useSWR<ServerResponseOne<HelpfulLinkAndSort>, AxiosError>(
        `/api/helpful-links?page=${pageQuery}&per_page=${perPage}`
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
    return (
        <>
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
