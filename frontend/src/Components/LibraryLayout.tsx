import {
    FilterLibraries,
    FilterLibrariesAdmin,
    Library,
    OpenContentProvider,
    ServerResponseMany,
    Tab,
    ToastState,
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
import { AxiosError } from 'axios';

export default function LibaryLayout({
    toaster,
    studentView
}: {
    toaster?: (msg: string, state: ToastState) => void;
    studentView?: boolean;
}) {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [perPage, setPerPage] = useState(20);
    const [pageQuery, setPageQuery] = useState<number>(1);
    const allLibrariesTab: Tab = {
        name: 'All',
        value: 'all'
    };
    let role = user?.role ?? UserRole.Student;
    const [activeTab, setActiveTab] = useState<Tab>(allLibrariesTab);
    const [filterLibraries, setFilterLibraries] = useState<string>(
        FilterLibraries['All Libraries']
    );
    const [filterLibrariesAdmin, setFilterLibrariesAdmin] = useState<string>(
        FilterLibrariesAdmin['All Libraries']
    );
    const {
        data: libraries,
        mutate: mutateLibraries,
        error: librariesError,
        isLoading: librariesLoading
    } = useSWR<ServerResponseMany<Library>, AxiosError>(
        `/api/libraries?page=${pageQuery}&per_page=${perPage}&visibility=${role == UserRole.Admin ? filterLibrariesAdmin : studentView ? 'visible' : filterLibraries}&search=${searchTerm}`
    );
    const { data: openContentProviders } =
        useSWR<ServerResponseMany<OpenContentProvider>>('/api/open-content');
    const openContentTabs = useMemo(() => {
        return [
            allLibrariesTab,
            ...(openContentProviders?.data?.map(
                (provider: OpenContentProvider) => ({
                    name: provider.name,
                    value: provider.id
                })
            ) ?? [])
        ];
    }, [openContentProviders]);

    useEffect(() => {
        setPageQuery(1);
    }, [filterLibrariesAdmin, filterLibraries, searchTerm]);
    if (studentView) {
        role = UserRole.Student;
    }
    if (!user) {
        return null;
    }
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
                        setState={setFilterLibrariesAdmin}
                    />
                ) : (
                    <DropdownControl
                        label="Filter by"
                        enumType={FilterLibraries}
                        setState={setFilterLibraries}
                    />
                )}
            </div>
            <div className="grid grid-cols-4 gap-6">
                {libraries?.data.map((library) => (
                    <LibraryCard
                        key={library.id}
                        library={library}
                        toaster={toaster}
                        mutate={mutateLibraries}
                        role={role}
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
        </div>
    );
}
