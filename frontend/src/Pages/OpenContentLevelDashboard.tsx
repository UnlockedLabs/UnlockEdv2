import {
    OpenContentFavorite,
    OpenContentItem,
    ResourceCategory,
    UserRole
} from '@/common';
import OpenContentCard from '@/Components/cards/OpenContentCard';
import ResourcesCategoryCard from '@/Components/ResourcesCategoryCard';
import ULIComponent from '@/Components/ULIComponent';
import { useAuth } from '@/useAuth';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useLoaderData, useNavigate } from 'react-router-dom';

export default function OpenContentLevelDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { resources, topUserContent, topFacilityContent, favorites } =
        useLoaderData() as {
            resources: ResourceCategory[];
            topUserContent: OpenContentItem[];
            topFacilityContent: OpenContentItem[];
            favorites: OpenContentFavorite[];
        };

    function navigateToOpenContent() {
        if (user?.role == UserRole.Student) {
            navigate(`/open-content/libraries`);
        } else {
            navigate(`/open-content-management/libraries`);
        }
    }

    return (
        <div className="flex flex-row h-full">
            {/* main section */}
            <div className="w-full flex flex-col gap-6 px-6 pb-4">
                <h1 className="text-5xl">
                    Hi, {user?.name_first ?? 'Student'}!
                </h1>
                <h2> Pick Up Where You Left Off</h2>
                <div className="grid grid-cols-2 gap-6">
                    <div className="card card-row-padding flex flex-col gap-3">
                        <h2>Your Top Open Content</h2>
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
                                className="card px-4 py-2 flex flex-row gap-2 items-center"
                                onClick={navigateToOpenContent}
                            >
                                <ULIComponent
                                    tooltipClassName="h-12 flex items-center"
                                    iconClassName="w-5 h-5"
                                    icon={ArrowTopRightOnSquareIcon}
                                />
                                <h3>Explore open content offered</h3>
                            </div>
                        )}
                    </div>
                    <div className="card card-row-padding flex flex-col gap-3">
                        <h2>Popular Open Content</h2>
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
                <div className="card card-row-padding overflow-x-scroll no-scrollbar">
                    {resources.map((resource: ResourceCategory) => (
                        <div key={resource.id} className="w-[252px]">
                            <ResourcesCategoryCard category={resource} />
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
