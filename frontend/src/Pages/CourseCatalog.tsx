import { useAuth } from '@/useAuth';
import ToggleView from '@/Components/ToggleView';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useState } from 'react';
import CatalogCourseCard from '@/Components/CatalogCourseCard';
import SearchBar from '@/Components/inputs/SearchBar';
import { CourseCatalogue, ServerResponse, ViewType } from '@/common';
import useSWR from 'swr';
import DropdownControl from '@/Components/inputs/DropdownControl';

// TO DO: make it paginated

export default function CourseCatalog() {
    const { user } = useAuth();
    const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);
    const [searchTerm, setSearchTerm] = useState('');
    const [order, setOrder] = useState('asc');
    const { data, error, mutate } = useSWR<ServerResponse<CourseCatalogue>>(
        `/api/users/${user.id}/catalogue?search=${searchTerm}&order=${order}`
    );
    const courseData = data?.data as CourseCatalogue[];

    function handleSearch(newSearch: string) {
        setSearchTerm(newSearch);
        // setPageQuery(1);
    }

    return (
        <AuthenticatedLayout title="Course Catalog" path={['Course Catalog']}>
            <div className="px-8 py-4">
                <div className="flex flex-row justify-between">
                    <h1>Course Catalog</h1>
                    <ToggleView
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                </div>
                <div className="flex flex-row items-center mt-4 justify-between">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleSearch}
                    />
                    <DropdownControl
                        label="order"
                        callback={setOrder}
                        enumType={{
                            Ascending: 'asc',
                            Descending: 'desc'
                        }}
                    />
                </div>
                {/* render on gallery or list view */}
                <div
                    className={`grid mt-8 ${activeView == ViewType.Grid ? 'grid-cols-4 gap-6' : 'gap-4'}`}
                >
                    {error ? (
                        <p className="text-error">Error loading courses.</p>
                    ) : courseData?.length == 0 ? (
                        <p className="text-error">No courses to display.</p>
                    ) : (
                        courseData?.map((course: CourseCatalogue) => {
                            return (
                                <CatalogCourseCard
                                    course={course}
                                    callMutate={() => mutate()}
                                    view={activeView}
                                    key={course.course_id}
                                />
                            );
                        })
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
