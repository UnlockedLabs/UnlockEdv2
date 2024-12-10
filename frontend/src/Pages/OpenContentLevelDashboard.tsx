import {
    Library,
    OpenContentFavorite,
    OpenContentItem,
    UserRole,
    ServerResponseOne,
    HelpfulLink
} from '@/common';
import OpenContentCard from '@/Components/cards/OpenContentCard';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import LibraryCard from '@/Components/LibraryCard';
import ULIComponent from '@/Components/ULIComponent';
import { isAdministrator, useAuth } from '@/useAuth';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useLoaderData, useNavigate } from 'react-router-dom';
import API from '@/api/api';

export default function StudentLayer1() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const {
        topUserContent,
        topFacilityContent,
        favorites,
        featured,
        helpfulLinks
    } = useLoaderData() as {
        topUserContent: OpenContentItem[];
        topFacilityContent: OpenContentItem[];
        favorites: OpenContentFavorite[];
        featured: Library[];
        helpfulLinks: HelpfulLink[];
    };
    const nav = isAdministrator(user)
        ? '/knowledge-center-management/libraries'
        : '/knowledge-center/libraries';
    function navigateToOpenContent() {
        navigate(nav);
    }

    async function handleHelpfulLinkClick(id: number): Promise<void> {
        const resp = (await API.put<{ url: string }, object>(
            `helpful-links/activity/${id}`,
            {}
        )) as ServerResponseOne<{ url: string }>;
        if (resp.success) {
            window.open(resp.data.url, '_blank');
            navigate(nav);
        }
    }

    return (
        <div className="flex flex-row h-full">
            {/* main section */}
            <div className="w-full flex flex-col gap-6 px-6 pb-4">
                <h1 className="text-5xl">
                    Hi, {user?.name_first ?? 'Student'}!
                </h1>
                <h2>Featured Content</h2>
                <div className="card card-row-padding grid grid-cols-3 gap-3">
                    {featured.map((item: Library) => {
                        return (
                            <LibraryCard
                                key={item.id}
                                library={item}
                                role={UserRole.Student}
                            />
                        );
                    })}
                </div>
                <h2> Pick Up Where You Left Off</h2>
                <div className="grid grid-cols-2 gap-6">
                    <div className="card card-row-padding flex flex-col gap-3">
                        <h2>Your Content</h2>
                        {topUserContent.map((item: OpenContentItem) => {
                            return (
                                <OpenContentCard
                                    key={item.content_id}
                                    content={item}
                                />
                            );
                        })}
                        {topUserContent.length < 5 && (
                            <div
                                className="card cursor-pointer px-4 py-2 flex flex-row gap-2 items-center"
                                onClick={navigateToOpenContent}
                            >
                                <ULIComponent
                                    tooltipClassName="h-12 flex items-center"
                                    icon={ArrowTopRightOnSquareIcon}
                                />
                                <h3 className="body font-normal">
                                    Explore other content offered
                                </h3>
                            </div>
                        )}
                    </div>
                    <div className="card card-row-padding flex flex-col gap-3">
                        <h2>Popular Knowledge-Center Content</h2>
                        {topFacilityContent.map((item: OpenContentItem) => {
                            return (
                                <OpenContentCard
                                    key={item.content_id}
                                    content={item}
                                />
                            );
                        })}
                    </div>
                </div>
                <h2>Resources</h2>
                <div className="card card-row-padding grid grid-cols-5 gap-3">
                    {helpfulLinks.map((link: HelpfulLink) => (
                        <div
                            key={link.id}
                            className="cursor-pointer"
                            onClick={(e) => {
                                e.preventDefault();
                                void handleHelpfulLinkClick(link.id);
                            }}
                        >
                            <HelpfulLinkCard
                                link={link}
                                role={UserRole.Student}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {/* right sidebar */}
            <div className="min-w-[300px] border-l border-grey-1 flex flex-col gap-6 px-6 py-4">
                <h2>Favorites</h2>
                <div className="space-y-3 w-full">
                    {favorites ? (
                        favorites.map((favorite: OpenContentFavorite) => {
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
