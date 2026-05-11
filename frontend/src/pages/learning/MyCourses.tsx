import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/auth/useAuth';
import { ServerResponse, UserCoursesInfo, UserCourses, ViewType } from '@/types';
import EnrolledCourseCard from '@/components/student/EnrolledCourseCard';
import { PageHeader, SearchInput, EmptyState } from '@/components/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, BookOpen } from 'lucide-react';

const SORT_OPTIONS = [
    { label: 'Name (A-Z)', value: 'order=asc&order_by=course_name' },
    { label: 'Name (Z-A)', value: 'order=desc&order_by=course_name' },
    { label: 'Progress (Low to High)', value: 'order=asc&order_by=course_progress' },
    { label: 'Progress (High to Low)', value: 'order=desc&order_by=course_progress' },
    { label: 'Start Date (Oldest)', value: 'order=asc&order_by=start_dt' },
    { label: 'Start Date (Newest)', value: 'order=desc&order_by=start_dt' }
];

export default function MyCourses() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [sort, setSort] = useState(SORT_OPTIONS[0].value);
    const [activeTab, setActiveTab] = useState('in_progress');
    const [view, setView] = useState<ViewType>(ViewType.Grid);

    if (!user) return null;

    const tagParam = activeTab !== 'all' ? `&tags=${activeTab}` : '';
    const searchParam = searchTerm ? `&search=${searchTerm}` : '';

    const { data, isLoading, error } = useSWR<ServerResponse<UserCoursesInfo>>(
        `/api/users/${user.id}/courses?${sort}${tagParam}${searchParam}`
    );

    const courseData = data?.data as UserCoursesInfo | undefined;
    const courses = courseData?.courses ?? [];

    return (
        <div className="bg-muted min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <PageHeader title="My Courses" />

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="in_progress">Current</TabsTrigger>
                        <TabsTrigger value="completed">Completed</TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3">
                            <SearchInput
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Search courses..."
                                className="w-64"
                            />
                            <Select value={sort} onValueChange={setSort}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map((opt) => (
                                        <SelectItem
                                            key={opt.value}
                                            value={opt.value}
                                        >
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center border border-border rounded-md">
                            <Button
                                variant={view === ViewType.Grid ? 'default' : 'ghost'}
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
                                variant={view === ViewType.List ? 'default' : 'ghost'}
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
                    </div>

                    {['in_progress', 'completed', 'all'].map((tab) => (
                        <TabsContent key={tab} value={tab}>
                            {isLoading && (
                                <p className="text-muted-foreground text-center py-8">
                                    Loading...
                                </p>
                            )}
                            {error && (
                                <p className="text-red-600 text-center py-8">
                                    Error loading courses.
                                </p>
                            )}
                            {!isLoading && !error && courses.length === 0 && (
                                <EmptyState
                                    icon={
                                        <BookOpen className="size-6 text-muted-foreground" />
                                    }
                                    title="No courses found"
                                    description="Try adjusting your search or filter."
                                />
                            )}
                            {!isLoading && !error && courses.length > 0 && (
                                <div
                                    className={
                                        view === ViewType.Grid
                                            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4'
                                            : 'space-y-3 mt-4'
                                    }
                                >
                                    {courses.map(
                                        (course: UserCourses, idx: number) => (
                                            <EnrolledCourseCard
                                                key={idx}
                                                course={course}
                                                view={view}
                                            />
                                        )
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    );
}
