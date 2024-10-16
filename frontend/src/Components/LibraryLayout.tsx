import {
    FilterLibraries,
    FilterLibrariesAdmin,
    Library,
    OpenContentProvider,
    ServerResponseMany,
    Tab,
    ToastProps,
    UserRole
} from '@/common';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '@/Components/inputs/SearchBar';
import LibraryCard from '@/Components/LibraryCard';
import TabView from '@/Components/TabView';
import { useAuth } from '@/useAuth';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

export default function LibaryLayout({
    setToast,
    studentView
}: {
    setToast?: React.Dispatch<React.SetStateAction<ToastProps>>;
    studentView?: boolean;
}) {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const [searchTerm, setSearchTerm] = useState<string>('');
    const allLibrariesTab: Tab = {
        name: 'All',
        value: 'all'
    };
    const [activeTab, setActiveTab] = useState<Tab>(allLibrariesTab);
    const [filterLibraries, setFilterLibraries] = useState<string>(
        FilterLibraries['All Libraries']
    );
    const [filterLibrariesAdmin, setFilterLibrariesAdmin] = useState<string>(
        FilterLibrariesAdmin['All Libraries']
    );
    let role = user.role;
    if (studentView) {
        role = UserRole.Student;
    }

    const { data: libraries, mutate: mutateLibraries } = useSWR<
        ServerResponseMany<Library>
    >(
        `/api/libraries?${role == UserRole.Admin ? filterLibrariesAdmin : filterLibraries}&search=${searchTerm}`
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
                {setToast &&
                    libraries?.data.map((library) => (
                        <LibraryCard
                            key={library.id}
                            library={library}
                            setToast={setToast}
                            mutate={mutateLibraries}
                            role={role}
                        />
                    ))}
            </div>
        </div>
    );
}
