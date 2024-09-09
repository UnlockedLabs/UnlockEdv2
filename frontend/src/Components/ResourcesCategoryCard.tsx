import { ResourceLink, ResourceCategory } from '@/common';
import ExternalLink from './ExternalLink';

export default function ResourcesCategoryCard({
    category
}: {
    category: ResourceCategory;
}) {
    const cardClasses = `card card-compact overflow-hidden`;

    return (
        <div className={cardClasses}>
            <div className="card-body gap-2">
                <h3 className="card-title text-sm">{category.name}</h3>
                {category.links.map((link: ResourceLink) => {
                    const [title, url] = Object.entries(link)[0];
                    return (
                        <ExternalLink key={url} url={url}>
                            {title}
                        </ExternalLink>
                    );
                })}
            </div>
        </div>
    );
}
