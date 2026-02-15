import { useLoaderData, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
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
            <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                <div className="h-[100px] bg-[#E2E7EA]">
                    {library.thumbnail_url ? (
                        <img
                            src={library.thumbnail_url}
                            alt={library.title}
                            className="object-cover w-full h-full"
                        />
                    ) : (
                        <div className="w-full h-full bg-[#E2E7EA]" />
                    )}
                </div>
                <CardContent className="p-3">
                    <h4 className="text-sm font-medium text-[#203622] line-clamp-2">
                        {library.title}
                    </h4>
                    {library.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                            {library.description}
                        </p>
                    )}
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
                        <h4 className="text-sm font-medium text-[#203622] line-clamp-1">
                            {link.title}
                        </h4>
                        {link.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
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
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
        >
            {item.thumbnail_url ? (
                <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-10 h-10 rounded object-cover shrink-0"
                />
            ) : (
                <div className="w-10 h-10 rounded bg-[#E2E7EA] shrink-0" />
            )}
            <p className="text-sm text-[#203622] truncate">{item.title}</p>
        </a>
    );
}

export default function ResidentHome() {
    const navigate = useNavigate();
    const { topUserContent, topFacilityContent } =
        useLoaderData() as ResidentHomeData;

    const { data: featured } = useSWR<ServerResponseMany<Library>>(
        '/api/libraries?visibility=featured&order_by=created_at'
    );
    const { data: favorites } = useSWR<ServerResponseMany<OpenContentItem>>(
        '/api/open-content/favorite-groupings'
    );
    const { data: helpfulLinks } = useSWR<ServerResponseOne<HelpfulLinkAndSort>>(
        '/api/helpful-links'
    );

    const featuredItems = featured?.data ?? [];
    const favoriteItems = favorites?.data ?? [];
    const links = helpfulLinks?.data?.helpful_links ?? [];

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto flex gap-6">
                <div className="flex-1 space-y-8">
                    {featuredItems.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-[#203622] mb-4">
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
                        <h2 className="text-xl font-semibold text-[#203622] mb-4">
                            Pick Up Where You Left Off
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <TopContentList
                                heading="Your Top Content"
                                items={topUserContent}
                                onViewAll={() =>
                                    navigate('/knowledge-center/libraries')
                                }
                            />
                            <TopContentList
                                heading="Popular Content"
                                items={topFacilityContent}
                                onViewAll={() =>
                                    navigate('/knowledge-center/libraries')
                                }
                            />
                        </div>
                    </section>

                    {links.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-[#203622] mb-4">
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

                <aside className="hidden xl:block w-[320px] shrink-0">
                    <div className="bg-white rounded-lg border border-gray-200 p-5 sticky top-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Star className="size-5 text-[#F1B51C]" />
                            <h2 className="text-lg font-semibold text-[#203622]">
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
