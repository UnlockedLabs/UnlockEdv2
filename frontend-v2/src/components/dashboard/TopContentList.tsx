import { OpenContentItem } from '@/types';
import { ExternalLink } from 'lucide-react';

interface TopContentListProps {
    heading: string;
    items: OpenContentItem[];
    onViewAll: () => void;
}

function ContentRow({ item }: { item: OpenContentItem }) {
    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow"
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
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#203622] truncate">
                    {item.title}
                </p>
                {item.provider_name && (
                    <p className="text-xs text-gray-500 truncate">
                        {item.provider_name}
                    </p>
                )}
            </div>
        </a>
    );
}

export default function TopContentList({
    heading,
    items,
    onViewAll
}: TopContentListProps) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-[#203622] mb-3">
                {heading}
            </h3>
            <div className="space-y-2">
                {items.map((item) => (
                    <ContentRow
                        key={`${item.content_id}-${item.url}`}
                        item={item}
                    />
                ))}
            </div>
            {items.length < 5 && (
                <button
                    onClick={onViewAll}
                    className="flex items-center gap-2 mt-3 text-sm text-[#556830] hover:underline"
                >
                    <ExternalLink className="size-4" />
                    Explore other content
                </button>
            )}
        </div>
    );
}
