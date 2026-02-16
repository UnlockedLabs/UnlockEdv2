import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    Library,
    OpenContentItem,
    ServerResponseMany,
    UserRole
} from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LibraryCard } from '@/components/knowledge-center';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { BookOpen, TrendingUp } from 'lucide-react';

interface TopContentListProps {
    heading: string;
    items: OpenContentItem[];
    onViewAll: () => void;
}

function TopContentList({ heading, items, onViewAll }: TopContentListProps) {
    return (
        <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                    {heading}
                </h3>
                <Button variant="link" size="sm" onClick={onViewAll}>
                    View All
                </Button>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                    No data available
                </p>
            ) : (
                <ul className="space-y-3">
                    {items.map((item, index) => (
                        <li
                            key={`${item.content_id}-${item.content_type}`}
                            className="flex items-center gap-3"
                        >
                            <span className="text-xs font-medium text-muted-foreground w-5 text-right">
                                {index + 1}
                            </span>
                            <img
                                src={item.thumbnail_url ?? '/ul-logo-d.svg'}
                                alt={item.title}
                                className="w-8 h-8 flex-shrink-0 object-cover rounded"
                            />
                            <span className="text-sm text-foreground line-clamp-1 flex-1">
                                {item.title}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

const TIME_FILTER_OPTIONS = [
    { label: 'Last 7 Days', value: '7' },
    { label: 'Last 30 Days', value: '30' },
    { label: 'Last 90 Days', value: '90' }
];

export default function KnowledgeInsights() {
    const navigate = useNavigate();
    const { featured } = useLoaderData() as { featured: Library[] };
    const [timeFilter, setTimeFilter] = useState('7');

    const { data: facilityLibraries } = useSWR<
        ServerResponseMany<OpenContentItem>
    >(`/api/libraries/activity?days=${timeFilter}&per_page=5`);

    const { data: favoritedLibraries } = useSWR<
        ServerResponseMany<OpenContentItem>
    >(`/api/libraries?order_by=most_popular&per_page=5`);

    function navigateToOpenContent() {
        navigate('/knowledge-center-management/libraries');
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Knowledge Insights"
                subtitle="Overview of featured content and library activity"
            />

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">
                        Featured Content
                    </h2>
                    <Button
                        variant="link"
                        size="sm"
                        onClick={navigateToOpenContent}
                    >
                        Manage Libraries
                    </Button>
                </div>
                {featured.length === 0 ? (
                    <EmptyState
                        icon={
                            <BookOpen className="size-6 text-muted-foreground" />
                        }
                        title="No featured content"
                        description="Feature content to showcase it here"
                        action={
                            <Button
                                className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
                                onClick={navigateToOpenContent}
                            >
                                Feature Content
                            </Button>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-4 gap-4">
                        {featured.map((library) => (
                            <LibraryCard
                                key={library.id}
                                library={library}
                                role={UserRole.Student}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <TrendingUp className="size-5" />
                        Insights
                    </h2>
                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TIME_FILTER_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <TopContentList
                        heading="Top Facility Libraries"
                        items={facilityLibraries?.data ?? []}
                        onViewAll={navigateToOpenContent}
                    />
                    <TopContentList
                        heading="Top Favorited Libraries"
                        items={favoritedLibraries?.data ?? []}
                        onViewAll={navigateToOpenContent}
                    />
                </div>
            </div>
        </div>
    );
}
