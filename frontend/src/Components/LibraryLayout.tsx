import {
    LibraryAdminVisibility,
    Library,
    ServerResponseMany,
    UserRole,
    Option
} from '@/common';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { MultiSelectDropdown } from './inputs';
import SearchBar from '@/Components/inputs/SearchBar';
import LibraryCard from '@/Components/LibraryCard';
import { isAdministrator, useAuth } from '@/useAuth';
import { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import Pagination from './Pagination';
import { AxiosError } from 'axios';
import { useLoaderData, useLocation, useNavigate } from 'react-router-dom';
import LibrarySearchResultsModal from '@/Components/LibrarySearchResultsModal';

export default function LibaryLayout({
    studentView
}: {
    studentView?: boolean;
}) {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const navigate = useNavigate();
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
    const navToLibraryViewer = (url: string, title: string) => {
        navigate(`/viewer/libraries/${searchModalLibrary?.id}`, {
            state: { url: url, title: title }
        });
    };
    const { categories } = useLoaderData() as {
        categories: Option[];
    };
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [categoryQueryString, setCategoryQueryString] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterVisibilityAdmin, setFilterVisibilityAdmin] = useState<string>(
        LibraryAdminVisibility['All Libraries']
    );
    let role = user.role;
    if (studentView) {
        role = UserRole.Student;
    }
    const [perPage, setPerPage] = useState(20);
    const [pageQuery, setPageQuery] = useState<number>(1);
    const route = useLocation();
    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };
    const {
        data: libraries,
        mutate: mutateLibraries,
        error: librariesError,
        isLoading: librariesLoading
    } = useSWR<ServerResponseMany<Library>, AxiosError>(
        `/api/libraries?page=${pageQuery}&per_page=${perPage}&visibility=${isAdministrator(user) && !adminWithStudentView() ? filterVisibilityAdmin : 'visible'}&search=${searchTerm}&${categoryQueryString}`
    );

    const librariesMeta = libraries?.meta ?? {
        total: 0,
        per_page: 20,
        page: 1,
        current_page: 1,
        last_page: 1
    };

    const handleSetPerPage = (perPage: number) => {
        setPerPage(perPage);
        setPageQuery(1);
        void mutateLibraries();
    };

    useEffect(() => {
        setPageQuery(1);
    }, [filterVisibilityAdmin, searchTerm, selectedCategories]);

    function updateLibrary() {
        void mutateLibraries();
    }

    useEffect(() => {
        const queryString = selectedCategories
            .map((category) => `category=${category}`)
            .join('&');
        setCategoryQueryString(queryString);
    }, [selectedCategories]);

    useEffect(() => {
        console.log(categoryQueryString);
    }, [categoryQueryString]);

    return (
        <>
            <div className="flex flex-row gap-4">
                <SearchBar
                    searchPlaceholder="Title Search..."
                    searchTerm={searchTerm}
                    changeCallback={setSearchTerm}
                />
                {isAdministrator(user) && !adminWithStudentView() && (
                    <DropdownControl
                        enumType={LibraryAdminVisibility}
                        setState={setFilterVisibilityAdmin}
                    />
                )}
                <MultiSelectDropdown
                    label="Categories"
                    options={categories}
                    selectedOptions={selectedCategories}
                    onSelectionChange={setSelectedCategories}
                    onBlurSearch={() => {
                        void mutateLibraries;
                    }}
                />
                {searchModalLibrary && (
                    <LibrarySearchResultsModal
                        ref={modalRef}
                        libraryId={searchModalLibrary.id}
                        searchPlaceholder={`Search ${searchModalLibrary.title}`}
                        onItemClick={navToLibraryViewer}
                        onModalClose={closeSearchModal}
                        useInternalSearchBar={true}
                    />
                )}
            </div>
            <div className="grid grid-cols-4 gap-6">
                {libraries?.data.map((library) => (
                    <LibraryCard
                        key={library.id}
                        library={library}
                        mutate={updateLibrary}
                        role={adminWithStudentView() ? UserRole.Student : role}
                        onSearchClick={() => openSearchModal(library)}
                    />
                ))}
            </div>
            {!librariesLoading && !librariesError && librariesMeta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={librariesMeta}
                        setPage={setPageQuery}
                        setPerPage={handleSetPerPage}
                    />
                </div>
            )}
        </>
    );
}
