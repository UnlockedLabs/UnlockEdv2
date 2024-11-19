import { useAuth } from '@/useAuth';
import EnrolledCourseCard from '@/Components/EnrolledCourseCard';
import { useState } from 'react';
import ToggleView from '@/Components/ToggleView';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { Tab } from '@/common';
import {
    ServerResponse,
    UserCourses,
    UserCoursesInfo,
    ViewType
} from '@/common';
import useSWR from 'swr';
import TabView from '@/Components/TabView';
import { AxiosError } from 'axios';

// TO DO: make sure this lives in the right place
export default function MyCourses() {
    const tabs: Tab[] = [
        { name: 'Current', value: 'in_progress' },
        { name: 'Completed', value: 'completed' },
        { name: 'All', value: 'all' }
    ];

    const { user } = useAuth();
    if (!user) return null;
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sort, setSort] = useState<string>('order=asc&order_by=course_name');
    const [activeTab, setActiveTab] = useState<Tab>(tabs[0]);
    const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);

    const { data, isLoading, error } = useSWR<
        ServerResponse<UserCoursesInfo>,
        AxiosError
    >(
        `/api/users/${user.id}/courses?${
            sort +
            (activeTab.value !== 'all' ? `&tags=${activeTab.value}` : '') +
            (searchTerm ? `&search=${searchTerm}` : '')
        }`
    );
    const courseData = data?.data as UserCoursesInfo;
    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error loading courses.</div>;

    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        // setPageQuery(1);
    };

    const handleSetTab = (tab: Tab) => {
        setActiveTab(tab);
    };

    return (
        <div className="px-8 py-4">
            <h1>My Courses</h1>
            <TabView
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={handleSetTab}
            />
            <div className="flex flex-row items-center mt-4 justify-between">
                <div className="flex flex-row gap-x-2">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleChange}
                    />
                    <DropdownControl
                        label="Sort by"
                        setState={setSort}
                        enumType={{
                            'Name (A-Z)': 'order=asc&order_by=course_name',
                            'Name (Z-A)': 'order=desc&order_by=course_name',
                            'Progress (ascending)':
                                'order=asc&order_by=course_progress',
                            'Progress (descending)':
                                'order=desc&order_by=course_progress'
                        }}
                    />
                </div>
                <ToggleView
                    activeView={activeView}
                    setActiveView={setActiveView}
                />
            </div>
            {/* render on gallery or list view */}
            <div
                className={`grid mt-8 ${activeView == ViewType.Grid ? 'grid-cols-4 gap-6' : 'gap-4'}`}
            >
                {courseData.courses.map(
                    (course: UserCourses, index: number) => {
                        return (
                            <EnrolledCourseCard
                                course={course}
                                view={activeView}
                                key={index}
                            />
                        );
                    }
                )}
            </div>
        </div>
    );
}
