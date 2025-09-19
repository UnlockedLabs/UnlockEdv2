import { Library, ServerResponseMany, UserRole, ViewType } from '@/common';
import LibraryCard from '@/Components/LibraryCard';
import { isAdministrator, useAuth } from '@/useAuth';
import { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import Pagination from './Pagination';
import { useLocation, useOutletContext } from 'react-router-dom';
import LibrarySearchResultsModal from '@/Components/LibrarySearchResultsModal';
import { useTourContext } from '@/Context/TourContext';
import { targetToStepIndexMap } from './UnlockEdTour';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import { closeModal, showModal } from './modals';
import LoadingSpinner from '@/Components/LoadingSpinner';

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
    const {
        activeView,
        searchQuery,
        filterVisibilityAdmin,
        categoryQueryString
    } = useOutletContext<{
        activeView: ViewType;
        searchQuery: string;
        filterVisibilityAdmin: string;
        categoryQueryString: string;
    }>();
    const [searchModalLibrary, setSearchModalLibrary] =
        useState<Library | null>(null);
    const modalRef = useRef<HTMLDialogElement>(null);
    //execute when the the searchModalLibrary changes
    useEffect(() => {
        if (searchModalLibrary && modalRef.current) {
            showModal(modalRef);
        }
    }, [searchModalLibrary]);

    const closeSearchModal = () => {
        if (modalRef.current) {
            closeModal(modalRef);
        }
        setSearchModalLibrary(null);
    };

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
        `/api/libraries?page=${pageQuery}&per_page=${perPage}&order_by=title&order=asc&visibility=${isAdministrator(user) && !adminWithStudentView() ? filterVisibilityAdmin : 'visible'}&search=${searchQuery}&${categoryQueryString}`
    );
    const librariesMeta = libraries?.meta;

    useEffect(() => {
        setPageQuery(1, { replace: true });
    }, [filterVisibilityAdmin, searchQuery, categoryQueryString]);

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
            {librariesLoading ? (
                <LoadingSpinner text="Loading libraries..." centered />
            ) : (
                <div
                    className={`${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
                >
                    {libraries?.data.map((library, index) => {
                        if (index === 0) {
                            return (
                                <div
                                    id="knowledge-center-enter-library"
                                    className={
                                        tourState.tourActive &&
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
                                            setSearchModalLibrary(library)
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
                                    adminWithStudentView()
                                        ? UserRole.Student
                                        : role
                                }
                                onSearchClick={() =>
                                    setSearchModalLibrary(library)
                                }
                                view={activeView}
                            />
                        );
                    })}
                </div>
            )}
            {!librariesLoading && !librariesError && librariesMeta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={librariesMeta}
                        setPage={setPageQuery}
                        setPerPage={setPerPage}
                    />
                </div>
            )}
            {searchModalLibrary && (
                <LibrarySearchResultsModal
                    ref={modalRef}
                    searchPlaceholder={`Search`}
                    onModalClose={closeSearchModal}
                    useInternalSearchBar={true}
                    libraryId={searchModalLibrary?.id}
                />
            )}
        </>
    );
}
