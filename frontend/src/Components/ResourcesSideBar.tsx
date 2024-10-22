import { Library, ResourceCategory, ServerResponse } from '@/common';
import Error from '@/Pages/Error';
import useSWR from 'swr';
import StaticContentCard from './StaticContentCard';
import ResourcesCategoryCard from './ResourcesCategoryCard';
import { AxiosError } from 'axios';

interface ResourcesSideBarProps {
    libraries: Library[];
}
export default function ResourcesSideBar({ libraries }: ResourcesSideBarProps) {
    const { data, isLoading, error } = useSWR<
        ServerResponse<ResourceCategory>,
        AxiosError
    >('/api/left-menu');

    if (isLoading) return <div>Loading...</div>;
    if (error) return <Error />;
    const categoryData = data?.data as ResourceCategory[];

    return (
        <div className="w-[409px] min-[1400px]:min-w-[409px] bg-background py-4 px-9">
            <div className="p-4 space-y-4">
                <h2>Open Content</h2>
                {libraries?.map((library: Library) => {
                    return (
                        <StaticContentCard
                            key={library.id}
                            title={library.name}
                            description={library.description ?? ''}
                            imgSrc={`${library.external_id}.png`}
                            altText={library.name}
                            linkUrl={`/viewer/libraries/${library.id}`}
                            linkText={`Explore Content`}
                        />
                    );
                })}
            </div>
            <div className="p-4 space-y-4">
                <h2>Resources</h2>
                <div className="flex flex-col gap-4">
                    {categoryData?.map(
                        (category: ResourceCategory, index: number) => {
                            return (
                                <ResourcesCategoryCard
                                    key={category.id + ' ' + index}
                                    category={category}
                                />
                            );
                        }
                    )}
                </div>
            </div>
        </div>
    );
}
