import { useLoaderData, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useEffect } from 'react';
import {
    OpenContentItem,
    HelpfulLink,
    HelpfulLinkAndSort,
    Library,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import TopContentList from '@/components/dashboard/TopContentList';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, Star } from 'lucide-react';
import { EmptyState } from '@/components/shared';
import { useTourContext } from '@/contexts/TourContext';
import { targetToStepIndexMap } from '@/components/UnlockEdTour';

interface ResidentHomeData {
    helpfulLinks: HelpfulLink[];
    topUserContent: OpenContentItem[];
    topFacilityContent: OpenContentItem[];
    favorites: OpenContentItem[];
}

function FeaturedLibraryCard({
    library,
    onClick
}: {
    library: Library;
    onClick: () => void;
}) {
    return (
        <div onClick={onClick} className="block cursor-pointer">
            <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                        {library.thumbnail_url ? (
                            <img
                                src={library.thumbnail_url}
                                alt={library.title}
                                className="size-12 rounded object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className="size-12 rounded bg-muted flex-shrink-0" />
                        )}
                        <h4 className="text-sm font-medium text-foreground line-clamp-1">
                            {library.title}
                        </h4>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {library.description ?? ''}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

function HelpfulLinkCard({ link }: { link: HelpfulLink }) {
    return (
        <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
        >
            <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4 flex items-start gap-3">
                    <ExternalLink className="size-5 text-[#556830] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <h4 className="text-sm font-medium text-foreground line-clamp-1">
                            {link.title}
                        </h4>
                        {link.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {link.description}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </a>
    );
}

function FavoriteItem({ item }: { item: OpenContentItem }) {
    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:shadow-md transition-shadow"
        >
            {item.thumbnail_url ? (
                <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-10 h-10 rounded object-cover shrink-0"
                />
            ) : (
                <div className="w-10 h-10 rounded bg-muted shrink-0" />
            )}
            <p className="text-sm text-foreground truncate">{item.title}</p>
        </a>
    );
}

export default function ResidentHome() {
    const navigate = useNavigate();
    const { topUserContent, topFacilityContent } =
        useLoaderData() as ResidentHomeData;
    const { tourState, setTourState } = useTourContext();

    const { data: featured } = useSWR<ServerResponseMany<Library>>(
        '/api/libraries?visibility=featured&order_by=created_at'
    );
    const { data: favorites } = useSWR<ServerResponseMany<OpenContentItem>>(
        '/api/open-content/favorite-groupings'
    );
    const { data: helpfulLinks } = useSWR<ServerResponseOne<HelpfulLinkAndSort>>(
        '/api/helpful-links'
    );

    useEffect(() => {
        if (tourState.tourActive && tourState.target === '#navigate-homepage') {
            setTourState({
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

    const featuredItems = featured?.data ?? [];
    const favoriteItems = favorites?.data ?? [];
    const links = helpfulLinks?.data?.helpful_links ?? [];

    return (
        <div className="bg-muted min-h-screen p-6" id="resident-home">
            <div className="max-w-7xl mx-auto flex gap-6">
                <div className="flex-1 space-y-8">
                    {featuredItems.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-4">
                                Featured Content
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {featuredItems.map((lib) => (
                                    <FeaturedLibraryCard
                                        key={`${lib.id}-${lib.open_content_provider_id}`}
                                        library={lib}
                                        onClick={() =>
                                            navigate(
                                                `/viewer/libraries/${lib.id}`
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <h2 className="text-xl font-semibold text-foreground mb-4">
                            Pick Up Where You Left Off
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="end-tour">
                            <div id="top-content">
                                <TopContentList
                                    heading="Your Top Content"
                                    items={topUserContent}
                                    onViewAll={() =>
                                        navigate('/knowledge-center')
                                    }
                                />
                            </div>
                            <div id="popular-content">
                                <TopContentList
                                    heading="Popular Content"
                                    items={topFacilityContent}
                                    onViewAll={() =>
                                        navigate('/knowledge-center')
                                    }
                                />
                            </div>
                        </div>
                    </section>

                    {links.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-4">
                                Helpful Links
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {links.map((link) => (
                                    <HelpfulLinkCard
                                        key={`${link.id}-${link.url}`}
                                        link={link}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <aside className="hidden xl:block w-[320px] shrink-0 space-y-6 sticky top-6 self-start">
                    <div className="bg-card rounded-lg border border-border p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Star className="size-5 text-[#F1B51C]" />
                            <h2 className="text-lg font-semibold text-foreground">
                                Favorites
                            </h2>
                        </div>
                        {favoriteItems.length > 0 ? (
                            <div className="space-y-2">
                                {favoriteItems.map((item) => (
                                    <FavoriteItem
                                        key={`${item.content_id}-${item.url}`}
                                        item={item}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title="No Favorites Yet"
                                description="Content you favorite will appear here for quick access."
                            />
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
