import {
    Library,
    OpenContentItem,
    UserRole,
    ServerResponseOne,
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseMany
} from '@/common';
import OpenContentCard from '@/Components/cards/OpenContentCard';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import { useAuth } from '@/useAuth';
import { useLoaderData, useNavigate } from 'react-router-dom';
import API from '@/api/api';
import { FeaturedContent } from '@/Components/dashboard';
import TopContentList from '@/Components/dashboard/TopContentList';
import useSWR from 'swr';
import { AxiosError } from 'axios';

export default function StudentLayer1() {
    const { user } = useAuth();
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
    >('api/open-content/favorites');
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
    }

    async function handleHelpfulLinkClick(id: number): Promise<void> {
        const resp = (await API.put<{ url: string }, object>(
            `helpful-links/activity/${id}`,
            {}
        )) as ServerResponseOne<{ url: string }>;
        if (resp.success) {
            window.open(resp.data.url, '_blank');
            navigate('/knowledge-center/libraries');
        }
    }

    return (
        <div className="flex flex-row h-full">
            {/* main section */}
            <div className="w-full flex flex-col gap-6 px-6 pb-4">
                <h1 className="text-5xl">
                    Hi, {user?.name_first ?? 'Student'}!
                </h1>
                <FeaturedContent
                    featured={featured?.data ?? []}
                    mutate={updateFavorites}
                />
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
                <h2>Helpful Links</h2>
                <div
                    className={`card card-row-padding grid grid-cols-${helpfulLinks?.data.helpful_links.length} gap-3`}
                >
                    {helpfulLinks?.data.helpful_links.map(
                        (link: HelpfulLink) => (
                            <div
                                key={link.id + link.url}
                                className="cursor-pointer"
                                onClick={(e) => {
                                    e.preventDefault();
                                    void handleHelpfulLinkClick(link.id);
                                }}
                            >
                                <HelpfulLinkCard
                                    link={link}
                                    role={UserRole.Student}
                                    mutate={mutateHelpfulFavs}
                                />
                            </div>
                        )
                    )}
                </div>
            </div>
            {/* right sidebar */}
            <div className="min-w-[300px] border-l border-grey-1 flex flex-col gap-6 px-6 py-4">
                <h2>Favorites</h2>
                <div className="space-y-3 w-full">
                    {favorites ? (
                        favorites.data.map((favorite: OpenContentItem) => {
                            return (
                                <OpenContentCard
                                    key={favorite.content_id}
                                    content={favorite}
                                />
                            );
                        })
                    ) : (
                        <div>No Favorites</div>
                    )}
                </div>
            </div>
        </div>
    );
}
