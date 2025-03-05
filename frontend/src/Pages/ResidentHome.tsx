import {
    Library,
    OpenContentItem,
    UserRole,
    ServerResponseOne,
    HelpfulLinkAndSort,
    ServerResponseMany,
    HelpfulLink
} from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import LibraryCard from '@/Components/LibraryCard';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { ExpandableCardGrid } from '@/Components/dashboard';
import TopContentList from '@/Components/dashboard/TopContentList';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import OpenContentItemAccordion from '@/Components/OpenContentItemAccordion';

export default function ResidentHome() {
    const navigate = useNavigate();
    const { topUserContent, topFacilityContent } = useLoaderData() as {
        topUserContent: OpenContentItem[];
        topFacilityContent: OpenContentItem[];
    };
    const { data: featured, mutate: mutateFeatLibs } = useSWR<
        ServerResponseMany<Library>,
        AxiosError
    >('api/libraries?visibility=featured');
    const { data: favorites, mutate: mutateFavLibs } = useSWR<
        ServerResponseMany<OpenContentItem>,
        AxiosError
    >('api/open-content/favorite-groupings');
    const { data: helpfulLinks, mutate: mutateHelpfulFavs } = useSWR<
        ServerResponseOne<HelpfulLinkAndSort>,
        AxiosError
    >(`api/helpful-links`);

    function navigateToOpenContent() {
        navigate('/knowledge-center/libraries');
    }

    function updateFavorites() {
        void mutateFavLibs();
        void mutateFeatLibs();
        void mutateHelpfulFavs();
    }

    return (
        <div className="flex flex-row h-full">
            {/* main section */}
            <div className="w-full flex flex-col gap-6 px-5 pb-4">
                <ExpandableCardGrid
                    items={featured?.data ?? []}
                    title="Featured Content"
                    cols={3}
                >
                    {(item: Library) => (
                        <LibraryCard
                            key={item.id + item.open_content_provider_id}
                            library={item}
                            role={UserRole.Student}
                            mutate={updateFavorites}
                        />
                    )}
                </ExpandableCardGrid>
                <h2> Pick Up Where You Left Off</h2>
                <div className="grid grid-cols-2 gap-6">
                    <TopContentList
                        heading="Your Top Content"
                        items={topUserContent}
                        navigateToOpenContent={navigateToOpenContent}
                    />
                    <TopContentList
                        heading="Popular Content"
                        items={topFacilityContent}
                        navigateToOpenContent={navigateToOpenContent}
                    />
                </div>
                <ExpandableCardGrid
                    items={helpfulLinks?.data.helpful_links ?? []}
                    title="Helpful Links"
                    emptyStateText="Add helpful links to share"
                    emptyStateLink="knowledge-center/helpful-links"
                    cols={4}
                >
                    {(link: HelpfulLink) => (
                        <HelpfulLinkCard
                            key={
                                link.id +
                                link.open_content_provider_id +
                                link.url
                            }
                            link={link}
                            role={UserRole.Student}
                            mutate={updateFavorites}
                        />
                    )}
                </ExpandableCardGrid>
            </div>
            {/* right sidebar */}
            <div className="min-w-[290px] xl:min-w-[390px] border-l border-grey-1 flex flex-col gap-6 px-6 py-4">
                <h2>Favorites</h2>
                <div className="space-y-3 w-full">
                    {favorites?.data && favorites.data.length > 0 ? (
                        <OpenContentItemAccordion items={favorites.data} />
                    ) : (
                        <div>No Favorites</div>
                    )}
                </div>
            </div>
        </div>
    );
}
