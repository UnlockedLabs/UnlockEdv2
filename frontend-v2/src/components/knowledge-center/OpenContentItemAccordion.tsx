import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Video, BookOpen, Info } from 'lucide-react';
import { OpenContentItem } from '@/types';

type OpenContentItemMap = Record<string, OpenContentItem[]>;

function ContentCard({ content }: { content: OpenContentItem }) {
    const navigate = useNavigate();

    const handleClick = () => {
        if (content.content_type === 'video') {
            navigate(`/viewer/videos/${content.content_id}`);
        } else if (content.content_type === 'library') {
            navigate(`/viewer/libraries/${content.content_id}`);
        } else if (content.content_type === 'helpful_link') {
            window.open(content.url, '_blank');
        }
    };

    return (
        <div
            className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border cursor-pointer hover:shadow-xs transition-shadow"
            onClick={handleClick}
        >
            <img
                src={content.thumbnail_url ?? '/ul-logo-d.svg'}
                alt={content.title}
                className="w-10 h-10 flex-shrink-0 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground line-clamp-1">
                    {content.title}
                </h4>
                {content.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                        {content.description}
                    </p>
                )}
            </div>
        </div>
    );
}

function getIconForCategory(title: string) {
    switch (title) {
        case 'Videos':
            return <Video className="size-4" />;
        case 'Libraries':
            return <BookOpen className="size-4" />;
        case 'Helpful Links':
            return <Info className="size-4" />;
        default:
            return null;
    }
}

export default function OpenContentItemAccordion({
    items
}: {
    items: OpenContentItem[];
}) {
    const contentMap: OpenContentItemMap = {};

    const libraries = items.filter((item) => item.content_type === 'library');
    const videos = items.filter((item) => item.content_type === 'video');
    const links = items.filter(
        (item) => item.content_type === 'helpful_link'
    );
    const others = items.filter(
        (item) =>
            !['library', 'video', 'helpful_link'].includes(item.content_type)
    );

    if (libraries.length > 0) contentMap['Libraries'] = libraries;
    if (videos.length > 0) contentMap['Videos'] = videos;
    if (links.length > 0) contentMap['Helpful Links'] = links;
    if (others.length > 0) contentMap['All Others'] = others;

    const [activeKey, setActiveKey] = useState<string | null>(null);

    const toggleAccordion = (key: string) => {
        setActiveKey(activeKey === key ? null : key);
    };

    return (
        <div className="w-full max-w-md mx-auto">
            {Object.entries(contentMap).map(([title, contentItems]) => (
                <div key={title} className="border-b border-border">
                    <button
                        className="flex items-center w-full px-4 py-3 text-left"
                        onClick={() => toggleAccordion(title)}
                    >
                        <ChevronRight
                            className={`size-4 mr-3 transition-transform ${
                                activeKey === title ? 'rotate-90' : ''
                            }`}
                        />
                        {getIconForCategory(title)}
                        <span className="flex-1 text-sm font-medium ml-2 text-foreground">
                            {title}
                        </span>
                    </button>
                    <div
                        className={`transition-[max-height] duration-300 ${
                            activeKey === title
                                ? 'overflow-visible max-h-[800px]'
                                : 'max-h-0 overflow-hidden'
                        }`}
                    >
                        <div className="flex flex-col gap-2 px-4 pb-3">
                            {contentItems.map((item) => (
                                <ContentCard key={item.url} content={item} />
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
