import {
    OpenContentProvider,
    ResourceCategory,
    ServerResponse
} from '@/common';
import Error from '@/Pages/Error';
import useSWR from 'swr';
import StaticContentCard from './StaticContentCard';
import ResourcesCategoryCard from './ResourcesCategoryCard';
import { AxiosError } from 'axios';

interface ResourcesSideBarProps {
    providers: OpenContentProvider[];
}
export default function ResourcesSideBar({ providers }: ResourcesSideBarProps) {
    const { data, isLoading, error } = useSWR<
        ServerResponse<ResourceCategory>,
        AxiosError
    >('/api/left-menu');

    if (isLoading) return <div>Loading...</div>;
    if (error) return <Error />;
    const categoryData = data?.data as ResourceCategory[];
    const getUrl = (prov: OpenContentProvider): string => {
        switch (prov.name.toLowerCase()) {
            case 'kiwix':
                return '/knowledge-center/libraries';
            case 'youtube':
                return '/knowledge-center/videos';
        }
        return '/knowledge-center/libraries';
    };
    return (
        <div className="w-[409px] min-[1400px]:min-w-[409px] bg-background py-4 px-9">
            <div className="p-4 space-y-4">
                <h2>Knowledge Center</h2>
                {providers?.map((provider: OpenContentProvider) => {
                    return (
                        <StaticContentCard
                            key={provider.id}
                            title={provider.name}
                            description={provider.description ?? ''}
                            imgSrc={provider.thumbnail_url ?? ''}
                            altText={provider.name}
                            linkUrl={getUrl(provider)}
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
