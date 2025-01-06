import {
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseOne,
    UserRole
} from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import { AxiosError } from 'axios';
import useSWR from 'swr';

export default function HelpfulLinks() {
    const {
        data: helpfulLinks,
        mutate: mutateHelpfulFavs,
        isLoading,
        error
    } = useSWR<ServerResponseOne<HelpfulLinkAndSort>, AxiosError>(
        `/api/helpful-links`
    );
    function updateFavorites() {
        void mutateHelpfulFavs();
    }
    return (
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
    );
}
