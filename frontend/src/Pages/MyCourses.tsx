import { useAuth } from '@/AuthContext';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import EnrolledCourseCard from '@/Components/EnrolledCourseCard';
import { useState } from 'react';
import ToggleView, { ViewType } from '@/Components/ToggleView';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { ServerResponse, UserPrograms, UserProgramsInfo } from '@/common';
import useSWR from 'swr';

// TO DO: make sure this lives in the right place
export enum CourseStatus {
    Current = 'Current',
    Completed = 'Completed',
    Pending = 'Pending',
    Recent = 'Recent'
}

enum TabType {
    Current = 'in_progress',
    Completed = 'completed',
    Favorited = 'is_favorited',
    All = 'all'
}

// TO DO: go back and fix all "key" values that are mapped and make them intentional

export default function MyCourses() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sort, setSort] = useState<string>('order=asc&order_by=program_name');
    const [activeTab, setActiveTab] = useState<TabType>(TabType.Current);
    const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);

    const { data, mutate, isLoading, error } = useSWR<
        ServerResponse<UserProgramsInfo>
    >(
        `/api/users/${user.id}/programs?${
            sort +
            (activeTab !== TabType.All ? `&tags=${activeTab}` : '') +
            (searchTerm ? `&search=${searchTerm}` : '')
        }`
    );
    const programData = data?.data as UserProgramsInfo;
    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error loading courses.</div>;

    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        // setPageQuery(1);
    };

    function handleDropdownChange(value: string) {
        setSort(value);
    }

    return (
        <AuthenticatedLayout title="My Courses" path={['My Courses']}>
            <div className="px-8 py-4">
                <h1>My Courses</h1>
                <div className="flex flex-row gap-16 w-100 border-b-2 border-grey-2 py-3">
                    {Object.entries(TabType).map(([key]) => (
                        <button
                            className={
                                activeTab == TabType[key]
                                    ? 'text-teal-4 font-bold'
                                    : ''
                            }
                            onClick={() => setActiveTab(TabType[key])}
                            key={Math.random()}
                        >
                            {key}
                        </button>
                    ))}
                </div>
                <div className="flex flex-row items-center mt-4 justify-between">
                    <div className="flex flex-row gap-x-2">
                        <SearchBar
                            searchTerm={searchTerm}
                            changeCallback={handleChange}
                        />
                        <DropdownControl
                            label="Sort by"
                            callback={handleDropdownChange}
                            enumType={{
                                'Name (A-Z)': 'order=asc&order_by=program_name',
                                'Name (Z-A)':
                                    'order=desc&order_by=program_name',
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
                    {programData.programs.map(
                        (course: UserPrograms, index: number) => {
                            return (
                                <EnrolledCourseCard
                                    course={course}
                                    view={activeView}
                                    callMutate={mutate}
                                    key={index}
                                />
                            );
                        }
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
