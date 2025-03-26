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
import { useEffect } from 'react';
import { useTourContext } from '@/Context/TourContext';
import { targetToStepIndexMap } from '@/Components/UnlockEdTour';

export default function ResidentHome() {
    const navigate = useNavigate();
    const { topUserContent, topFacilityContent } = useLoaderData() as {
        topUserContent: OpenContentItem[];
        topFacilityContent: OpenContentItem[];
    };
    const { data: featured, mutate: mutateFeatLibs } = useSWR<
        ServerResponseMany<Library>,
        AxiosError
    >('api/libraries?visibility=featured&order_by=created_at');
    const { data: favorites, mutate: mutateFavLibs } = useSWR<
        ServerResponseMany<OpenContentItem>,
        AxiosError
    >('api/open-content/favorite-groupings');
    const { data: helpfulLinks, mutate: mutateHelpfulFavs } = useSWR<
        ServerResponseOne<HelpfulLinkAndSort>,
        AxiosError
    >(`api/helpful-links`);
    const { tourState, setTourState } = useTourContext();

    function navigateToOpenContent() {
        navigate('/knowledge-center/libraries');
    }

    function updateFavorites() {
        void mutateFavLibs();
        void mutateFeatLibs();
        void mutateHelpfulFavs();
    }

    useEffect(() => {
        if (tourState.tourActive && tourState.target === '#navigate-homepage') {
            setTourState({
                // this is a bit buggy, not sure why I have to skip to popular-content, but if I don't, it messes up the tooltip.
                stepIndex: targetToStepIndexMap['#popular-content'],
                target: '#popular-content'
            });
        } else if (tourState.tourActive && tourState.stepIndex !== 1) {
            setTourState({
                run: true,
                stepIndex: 0,
                target: '#resident-home'
            });
        }
    }, [tourState.tourActive]);

    return (
        <div className="flex flex-row h-full" id="resident-home">
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
                <div className="grid grid-cols-2 gap-6" id="end-tour">
                    <div id="top-content">
                        <TopContentList
                            heading="Your Top Content"
                            items={topUserContent}
                            navigateToOpenContent={navigateToOpenContent}
                        />
                    </div>
                    <div id="popular-content">
                        <TopContentList
                            heading="Popular Content"
                            items={topFacilityContent}
                            navigateToOpenContent={navigateToOpenContent}
                        />
                    </div>
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
