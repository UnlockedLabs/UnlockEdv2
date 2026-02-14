import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/auth/useAuth';
import { ServerResponse, CourseCatalogResponse, ViewType } from '@/types';
import CatalogCourseCard from '@/components/student/CatalogCourseCard';
import { PageHeader, SearchInput, EmptyState } from '@/components/shared';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Search } from 'lucide-react';

export default function CourseCatalog() {
    const { user } = useAuth();
    const [view, setView] = useState<ViewType>(ViewType.Grid);
    const [searchTerm, setSearchTerm] = useState('');
    const [order, setOrder] = useState('asc');

    if (!user) return null;

    const { data, error, isLoading } = useSWR<
        ServerResponse<CourseCatalogResponse>
    >(`/api/users/${user.id}/catalog?search=${searchTerm}&order=${order}`);

    const courses = (data?.data as CourseCatalogResponse[] | undefined) ?? [];

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <PageHeader
                    title="Course Catalog"
                    subtitle="Browse available courses"
                    actions={
                        <div className="flex items-center border border-gray-200 rounded-md">
                            <Button
                                variant={
                                    view === ViewType.Grid ? 'default' : 'ghost'
                                }
                                size="sm"
                                onClick={() => setView(ViewType.Grid)}
                                className={
                                    view === ViewType.Grid
                                        ? 'bg-[#203622] text-white'
                                        : ''
                                }
                            >
                                <LayoutGrid className="size-4" />
                            </Button>
                            <Button
                                variant={
                                    view === ViewType.List ? 'default' : 'ghost'
                                }
                                size="sm"
                                onClick={() => setView(ViewType.List)}
                                className={
                                    view === ViewType.List
                                        ? 'bg-[#203622] text-white'
                                        : ''
                                }
                            >
                                <List className="size-4" />
                            </Button>
                        </div>
                    }
                />

                <div className="flex items-center justify-between">
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search courses..."
                        className="w-72"
                    />
                    <Select value={order} onValueChange={setOrder}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asc">A - Z</SelectItem>
                            <SelectItem value="desc">Z - A</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isLoading && (
                    <p className="text-gray-500 text-center py-8">Loading...</p>
                )}

                {error && (
                    <p className="text-red-600 text-center py-8">
                        Error loading courses.
                    </p>
                )}

                {!isLoading && !error && courses.length === 0 && (
                    <EmptyState
                        icon={<Search className="size-6 text-gray-400" />}
                        title="No courses found"
                        description="Try adjusting your search terms."
                    />
                )}

                {!isLoading && !error && courses.length > 0 && (
                    <div
                        className={
                            view === ViewType.Grid
                                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
                                : 'space-y-3'
                        }
                    >
                        {courses.map((course: CourseCatalogResponse) => (
                            <CatalogCourseCard
                                key={course.course_id}
                                course={course}
                                view={view}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
