import { useAuth } from '@/useAuth';
import ToggleView from '@/Components/ToggleView';
import { useState } from 'react';
import CatalogCourseCard from '@/Components/CatalogCourseCard';
import SearchBar from '@/Components/inputs/SearchBar';
import { CourseCatalogResponse, ServerResponse, ViewType } from '@/common';
import useSWR from 'swr';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { AxiosError } from 'axios';
// TO DO: make it paginated

export default function CourseCatalog() {
    const { user } = useAuth();
    if (!user) {
        return;
    }
    const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);
    const [searchTerm, setSearchTerm] = useState('');
    const [order, setOrder] = useState('asc');
    const { data, error } = useSWR<
        ServerResponse<CourseCatalogResponse>,
        AxiosError
    >(`/api/users/${user.id}/catalog?search=${searchTerm}&order=${order}`);
    const courseData = data?.data as CourseCatalogResponse[];

    function handleSearch(newSearch: string) {
        setSearchTerm(newSearch);
        // setPageQuery(1);
    }

    return (
        <div className="px-8 py-4">
            <div className="flex flex-row justify-between">
                <h1 className="invisible">Placeholder</h1>
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
                    setState={setOrder}
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
                    courseData?.map((course: CourseCatalogResponse) => {
                        return (
                            <CatalogCourseCard
                                course={course}
                                view={activeView}
                                key={course.course_id}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
}
