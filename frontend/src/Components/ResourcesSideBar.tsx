import { OpenContentProvider, HelpfulLink, UserRole } from '@/common';
import StaticContentCard from './StaticContentCard';
import { useLoaderData } from 'react-router-dom';
import HelpfulLinkCard from './cards/HelpfulLinkCard';

export default function ResourcesSideBar() {
    const { providers, resources } = useLoaderData() as {
        providers: OpenContentProvider[];
        resources: HelpfulLink[];
    };
    const getUrl = (prov: OpenContentProvider): string => {
        switch (prov.title.toLowerCase()) {
            case 'kiwix':
                return '/knowledge-center/libraries';
            case 'youtube':
                return '/knowledge-center/videos';
        }
        return '/knowledge-center/libraries';
    };
    return (
        <div className="min-[1400px]:min-w-[300px] bg-background border-l border-grey-1">
            <div className="p-4 space-y-4">
                <h2>Knowledge Center</h2>
                {providers?.map((provider: OpenContentProvider) => {
                    return (
                        <StaticContentCard
                            key={provider.id}
                            title={provider.title}
                            description={provider.description ?? ''}
                            imgSrc={provider.thumbnail_url ?? ''}
                            altText={provider.title}
                            linkUrl={getUrl(provider)}
                            linkText={`Explore Content`}
                        />
                    );
                })}
            </div>
            <div className="p-4 space-y-4">
                <h2>Resources</h2>
                <div className="flex flex-col gap-4">
                    {resources?.map((link: HelpfulLink, index: number) => {
                        return (
                            <HelpfulLinkCard
                                key={index}
                                link={link}
                                role={UserRole.Student}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
