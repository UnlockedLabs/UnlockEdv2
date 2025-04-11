import {
    LibraryAdminVisibility,
    Library,
    ServerResponseMany,
    UserRole,
    Option,
    ViewType
} from '@/common';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '@/Components/inputs/SearchBar';
import LibraryCard from '@/Components/LibraryCard';
import { isAdministrator, useAuth } from '@/useAuth';
import { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import Pagination from './Pagination';
import { useLoaderData, useLocation } from 'react-router-dom';
import LibrarySearchResultsModal from '@/Components/LibrarySearchResultsModal';
import CategoryDropdownFilter from './CategoryDropdownFilter';
import { useTourContext } from '@/Context/TourContext';
import { targetToStepIndexMap } from './UnlockEdTour';
import ToggleView from '@/Components/ToggleView';
import { useSessionViewType } from '@/Hooks/sessionView';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';

export default function LibaryLayout({
    studentView
}: {
    studentView?: boolean;
}) {
    const { tourState, setTourState } = useTourContext();
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const [activeView, setActiveView] = useSessionViewType('libraryView');
    const [searchModalLibrary, setSearchModalLibrary] =
        useState<Library | null>(null);
    const modalRef = useRef<HTMLDialogElement>(null);
    //execute when the the searchModalLibrary changes
    useEffect(() => {
        if (searchModalLibrary && modalRef.current) {
            modalRef.current.style.visibility = 'visible';
            modalRef.current.showModal();
        }
    }, [searchModalLibrary]);

    const openSearchModal = (library: Library) => {
        setSearchModalLibrary(library); //fire off useEffect
    };
    const closeSearchModal = () => {
        if (modalRef.current) {
            modalRef.current.style.visibility = 'hidden';
            modalRef.current.close();
        }
        setSearchModalLibrary(null);
    };
    const { categories } = useLoaderData() as {
        categories: Option[];
    };
    const [categoryQueryString, setCategoryQueryString] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterVisibilityAdmin, setFilterVisibilityAdmin] = useState<string>(
        LibraryAdminVisibility['All Libraries']
    );
    let role = user.role;
    if (studentView) {
        role = UserRole.Student;
    }

    const route = useLocation();
    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const {
        data: libraries,
        mutate: mutateLibraries,
        error: librariesError,
        isLoading: librariesLoading
    } = useSWR<ServerResponseMany<Library>, Error>(
        `/api/libraries?page=${pageQuery}&per_page=${perPage}&order_by=title&order=asc&visibility=${isAdministrator(user) && !adminWithStudentView() ? filterVisibilityAdmin : 'visible'}&search=${searchTerm}&${categoryQueryString}`
    );
    const librariesMeta = libraries?.meta;

    useEffect(() => {
        setPageQuery(1, { replace: true });
    }, [filterVisibilityAdmin, searchTerm, categoryQueryString]);

    function updateLibrary() {
        void mutateLibraries();
    }

    useEffect(() => {
        if (tourState.tourActive) {
            if (
                tourState.target === '#library-viewer-sub-page' ||
                tourState.target === '#knowledge-center-fav-lib'
            ) {
                setTourState({
                    stepIndex:
                        targetToStepIndexMap['#knowledge-center-enter-library'],
                    target: '#knowledge-center-enter-library'
                });
            }
        }
    }, []);

    return (
        <>
            <div className="flex flex-row gap-4">
                <div
                    onClick={() => setSearchModalLibrary({} as Library)}
                    id="knowledge-center-search"
                >
                    <SearchBar
                        searchPlaceholder="Search..."
                        searchTerm={searchTerm}
                        changeCallback={setSearchTerm}
                        autoFocus={false}
                    />
                </div>
                {isAdministrator(user) && !adminWithStudentView() && (
                    <DropdownControl
                        enumType={LibraryAdminVisibility}
                        setState={setFilterVisibilityAdmin}
                    />
                )}
                <div id="knowledge-center-filters">
                    <CategoryDropdownFilter
                        mutate={() => void mutateLibraries()}
                        setCategoryQueryString={setCategoryQueryString}
                        options={categories}
                    />
                </div>
                {searchModalLibrary && (
                    <LibrarySearchResultsModal
                        ref={modalRef}
                        searchPlaceholder={`Search`}
                        onModalClose={closeSearchModal}
                        useInternalSearchBar={true}
                    />
                )}
                <div className="ml-auto">
                    <ToggleView
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                </div>
            </div>

            <div
                className={`mt-4 ${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
            >
                {libraries?.data.map((library, index) => {
                    if (index === 0) {
                        return (
                            <div
                                id="knowledge-center-enter-library"
                                className={
                                    tourState.target ===
                                    '#knowledge-center-enter-library'
                                        ? 'animate-pulse border border-2 border-primary-yellow rounded-xl'
                                        : ''
                                }
                                key={library.id}
                            >
                                <LibraryCard
                                    key={library.id}
                                    library={library}
                                    mutate={updateLibrary}
                                    role={
                                        adminWithStudentView()
                                            ? UserRole.Student
                                            : role
                                    }
                                    onSearchClick={() =>
                                        openSearchModal(library)
                                    }
                                    view={activeView}
                                />
                            </div>
                        );
                    }
                    return (
                        <LibraryCard
                            key={library.id}
                            library={library}
                            mutate={updateLibrary}
                            role={
                                adminWithStudentView() ? UserRole.Student : role
                            }
                            onSearchClick={() => openSearchModal(library)}
                            view={activeView}
                        />
                    );
                })}
            </div>
            {!librariesLoading && !librariesError && librariesMeta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={librariesMeta}
                        setPage={setPageQuery}
                        setPerPage={setPerPage}
                    />
                </div>
            )}
        </>
    );
}
