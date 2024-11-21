import InternalLink from './InternalLink';

interface StaticContentCardProps {
    title: string;
    description: string;
    imgSrc: string;
    altText: string;
    linkUrl: string;
    linkText: string;
}

export default function StaticContentCard({
    title,
    description,
    imgSrc,
    altText,
    linkUrl,
    linkText
}: StaticContentCardProps) {
    return (
        <div className="card card-compact bg-base-teal overflow-hidden">
            <img
                src={imgSrc}
                alt={altText}
                className="h-[105px] self-center object-cover"
            />
            <div className="card-body gap-2">
                <h3 className="card-title text-sm">{title}</h3>
                <p className="body-small">{description}</p>

                <InternalLink url={linkUrl}>{linkText}</InternalLink>
            </div>
        </div>
    );
}
