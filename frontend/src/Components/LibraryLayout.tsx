import {
    FilterLibraries,
    LibraryAdminVisibility,
    Library,
    ServerResponseMany,
    UserRole,
    FilterLibrariesAdmin
} from '@/common';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '@/Components/inputs/SearchBar';
import LibraryCard from '@/Components/LibraryCard';
import { isAdministrator, useAuth } from '@/useAuth';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Pagination from './Pagination';
import { AxiosError } from 'axios';
import { useLocation } from 'react-router-dom';

export default function LibaryLayout({
    studentView
}: {
    studentView?: boolean;
}) {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterLibraries, setFilterLibraries] = useState<string>(
        FilterLibraries['All Libraries']
    );
    const [filterLibrariesAdmin, setFilterLibrariesAdmin] = useState<string>(
        LibraryAdminVisibility['All Libraries']
    );
    const [orderBy, setOrderBy] = useState<string>(FilterLibrariesAdmin.Newest);
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
    const getFilter = (): string => {
        return adminWithStudentView()
            ? 'visible'
            : isAdministrator(user)
              ? filterLibrariesAdmin
              : studentView
                ? 'visible'
                : filterLibraries;
    };
    const {
        data: libraries,
        mutate: mutateLibraries,
        error: librariesError,
        isLoading: librariesLoading
    } = useSWR<ServerResponseMany<Library>, AxiosError>(
        `/api/libraries?page=${pageQuery}&per_page=${perPage}&order_by=${adminWithStudentView() || isAdministrator(user) ? orderBy : ''}&visibility=${getFilter()}&search=${searchTerm}`
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
    }, [filterLibrariesAdmin, filterLibraries, searchTerm]);

    return (
        <>
            <div className="flex flex-row gap-4">
                <SearchBar
                    searchTerm={searchTerm}
                    changeCallback={setSearchTerm}
                />
                {adminWithStudentView() || role === UserRole.Student ? (
                    <DropdownControl
                        label="Filter by"
                        enumType={FilterLibraries}
                        setState={setFilterLibraries}
                    />
                ) : (
                    <>
                        <DropdownControl
                            label="Show"
                            enumType={LibraryAdminVisibility}
                            setState={setFilterLibrariesAdmin}
                        />
                        <DropdownControl
                            label="Filter by"
                            enumType={FilterLibrariesAdmin}
                            setState={setOrderBy}
                        />
                    </>
                )}
            </div>
            <div className="grid grid-cols-4 gap-6">
                {libraries?.data.map((library) => (
                    <LibraryCard
                        key={library.id}
                        library={library}
                        mutate={mutateLibraries}
                        role={adminWithStudentView() ? UserRole.Student : role}
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
