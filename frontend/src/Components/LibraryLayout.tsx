import {
    FilterLibraries,
    FilterLibrariesAdmin,
    Library,
    OpenContentProvider,
    PaginationMeta,
    ServerResponse,
    Tab,
    ToastProps,
    UserRole
} from '@/common';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '@/Components/inputs/SearchBar';
import LibraryCard from '@/Components/LibraryCard';
import TabView from '@/Components/TabView';
import { useAuth } from '@/useAuth';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Pagination from './Pagination';

export default function LibaryLayout({
    setToast,
    studentView
}: {
    setToast?: React.Dispatch<React.SetStateAction<ToastProps>>;
    studentView?: boolean;
}) {
    const [searchTerm, setSearchTerm] = useState<string>('');
    const allLibrariesTab: Tab = {
        name: 'All',
        value: 'all'
    };
    const [activeTab, setActiveTab] = useState<Tab>(allLibrariesTab);
    const [filterLibraries, setFilterLibraries] = useState<FilterLibraries>(
        FilterLibraries['All Libraries']
    );
    const [filterLibrariesAdmin, setFilterLibrariesAdmin] =
        useState<FilterLibrariesAdmin>(FilterLibrariesAdmin['All Libraries']);
    let role = useAuth().user.role;
    if (studentView) {
        role = UserRole.Student;
    }

    const [pageQuery, setPageQuery] = useState<number>(1);

    const {
        data: libraries,
        mutate: mutateLibraries,
        error: librariesError,
        isLoading: librariesLoading
    } = useSWR<ServerResponse<Library[]>>(
        `/api/libraries?page=${pageQuery}&per_page=20&visibility=${role == UserRole.Admin ? filterLibrariesAdmin : studentView ? 'visible' : filterLibraries}&search=${searchTerm}`
    );
    const librariesMeta = libraries?.meta as PaginationMeta;

    const { data: openContentProviders } =
        useSWR<ServerResponse<OpenContentProvider[]>>('/api/open-content');

    const openContentTabs = useMemo(() => {
        return [
            allLibrariesTab,
            ...(openContentProviders?.data?.map((provider) => ({
                name: provider.name,
                value: provider.id
            })) ?? [])
        ];
    }, [openContentProviders]); //eslint-disable-line

    useEffect(() => {
        setPageQuery(1);
    }, [filterLibrariesAdmin, filterLibraries, searchTerm]);

    return (
        <div className="pt-6 space-y-6">
            <TabView
                tabs={openContentTabs}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />
            <div className="flex flex-row gap-4">
                <SearchBar
                    searchTerm={searchTerm}
                    changeCallback={setSearchTerm}
                />
                {role == UserRole.Admin ? (
                    <DropdownControl
                        label="Filter by"
                        enumType={FilterLibrariesAdmin}
                        callback={setFilterLibrariesAdmin}
                    />
                ) : (
                    <DropdownControl
                        label="Filter by"
                        enumType={FilterLibraries}
                        callback={setFilterLibraries}
                    />
                )}
            </div>
            <div className="grid grid-cols-4 gap-6">
                {libraries?.data.map((library) => (
                    <LibraryCard
                        key={library.id}
                        library={library}
                        setToast={setToast}
                        mutate={mutateLibraries}
                        role={role}
                    />
                ))}
            </div>
            {!librariesLoading &&
                !librariesError &&
                libraries.data.length > 0 && (
                    <div className="flex justify-center">
                        <Pagination
                            meta={librariesMeta}
                            setPage={setPageQuery}
                        />
                    </div>
                )}
        </div>
    );
}
