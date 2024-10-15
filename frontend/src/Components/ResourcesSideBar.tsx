import { ResourceCategory, ServerResponse } from '@/common';
import Error from '@/Pages/Error';
import useSWR from 'swr';
import StaticContentCard from './StaticContentCard';
import ResourcesCategoryCard from './ResourcesCategoryCard';
import { AxiosError } from 'axios';

const KolibriCard = () => {
    return (
        <StaticContentCard
            title="Kolibri"
            description="Kolibri provides an extensive library of educational content suitable for all learning levels."
            imgSrc="kolibri-card-cover.png"
            altText="Kolibri logo"
            linkUrl="https://kolibri.v2.unlockedlabs.xyz/oidcauthenticate/"
            linkText="Explore Kolibri's Content"
        />
    );
};

const WikiCard = () => {
    return (
        <StaticContentCard
            title="Wikipedia"
            description="Wikipedia offers a vast collection of articles covering a wide range of topics across various academic disciplines."
            imgSrc="wikipedia.png"
            altText="Wikipedia logo"
            linkUrl="https://kiwix.v2.unlockedlabs.xyz/viewer#wikipedia/A/User%3AThe_other_Kiwix_guy/Landing"
            linkText="Explore Wikipedia's Content"
        />
    );
};

export default function ResourcesSideBar() {
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
                <KolibriCard />
                <WikiCard />
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
