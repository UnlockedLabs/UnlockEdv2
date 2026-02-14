import { useEffect, useMemo, useState } from 'react';
import {
    Outlet,
    useLocation,
    useNavigate,
    useLoaderData
} from 'react-router-dom';
import { useAuth, isAdministrator, hasFeature } from '@/auth/useAuth';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, List } from 'lucide-react';
import { useSessionViewType } from '@/hooks/useSessionViewType';
import { useDebounceValue } from 'usehooks-ts';
import {
    OpenContentTabs,
    FeatureAccess,
    LibraryAdminVisibility,
    VideoAdminVisibility,
    FilterOpenContent,
    Option,
    ViewType
} from '@/types';

interface TabOption {
    name: string;
    value: string;
}

export default function OpenContent() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const route = useLocation();

    const isAdmin = isAdministrator(user);
    const isManagement = route.pathname.startsWith(
        '/knowledge-center-management'
    );
    const basePath = isManagement
        ? '/knowledge-center-management'
        : '/knowledge-center';

    const tabOptions = useMemo<TabOption[]>(
        () => [
            { name: OpenContentTabs.KIWIX, value: 'libraries' },
            { name: OpenContentTabs.VIDEOS, value: 'videos' },
            ...(user && hasFeature(user, FeatureAccess.HelpfulLinksAccess)
                ? [{ name: OpenContentTabs.LINKS, value: 'helpful-links' }]
                : []),
            ...(!isManagement
                ? [{ name: OpenContentTabs.FAVORITES, value: 'favorites' }]
                : [])
        ],
        [isManagement, user]
    );

    const currentTabValue = route.pathname.split('/')[2] ?? 'libraries';
    const [activeTab, setActiveTab] = useState(currentTabValue);

    useEffect(() => {
        setActiveTab(currentTabValue);
        if (currentTabValue === 'videos') {
            setVideoVisibilityAdmin(VideoAdminVisibility['All Videos']);
        } else if (currentTabValue === 'libraries') {
            setFilterLibraryVisibilityAdmin(
                LibraryAdminVisibility['All Libraries']
            );
        }
        setSortQuery(FilterOpenContent['Title (A to Z)']);
        setSearchTerm('');
    }, [route.pathname]);

    const handleTabChange = (value: string) => {
        navigate(`${basePath}/${value}`);
        setActiveTab(value);
    };

    const handleSwitchView = () => {
        if (!isAdmin) return;
        if (isManagement) {
            navigate(`/knowledge-center/${activeTab}`);
        } else {
            if (activeTab === 'favorites') {
                navigate('/knowledge-center-management/libraries');
            } else {
                navigate(`/knowledge-center-management/${activeTab}`);
            }
        }
    };

    const [activeView, setActiveView] = useSessionViewType('libraryView');

    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery] = useDebounceValue(searchTerm, 500);

    const { categories } = useLoaderData() as { categories: Option[] };
    const [filterLibraryVisibilityAdmin, setFilterLibraryVisibilityAdmin] =
        useState(LibraryAdminVisibility['All Libraries']);
    const [filterVideoVisibilityAdmin, setVideoVisibilityAdmin] = useState(
        VideoAdminVisibility['All Videos']
    );
    const [categoryQueryString, setCategoryQueryString] = useState('');
    const [sortQuery, setSortQuery] = useState(
        FilterOpenContent['Title (A to Z)']
    );

    const handleCategoryChange = (value: string) => {
        if (value === 'all') {
            setCategoryQueryString('');
        } else {
            setCategoryQueryString(`tag=${value}`);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search..."
                    className="w-64"
                />
                {currentTabValue === 'libraries' && (
                    <>
                        <Select
                            value={categoryQueryString || 'all'}
                            onValueChange={handleCategoryChange}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Categories
                                </SelectItem>
                                {categories?.map((cat) => (
                                    <SelectItem
                                        key={cat.key}
                                        value={cat.value}
                                    >
                                        {cat.value}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isAdmin && isManagement && (
                            <Select
                                value={filterLibraryVisibilityAdmin}
                                onValueChange={(v) =>
                                    setFilterLibraryVisibilityAdmin(
                                        v as LibraryAdminVisibility
                                    )
                                }
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(
                                        LibraryAdminVisibility
                                    ).map(([label, value]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </>
                )}
                {currentTabValue === 'videos' && (
                    <>
                        <Select
                            value={sortQuery}
                            onValueChange={(v) => setSortQuery(v)}
                        >
                            <SelectTrigger className="w-52">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(FilterOpenContent).map(
                                    ([label, value]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    )
                                )}
                            </SelectContent>
                        </Select>
                        {isAdmin && isManagement && (
                            <Select
                                value={filterVideoVisibilityAdmin}
                                onValueChange={(v) =>
                                    setVideoVisibilityAdmin(
                                        v as VideoAdminVisibility
                                    )
                                }
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(VideoAdminVisibility).map(
                                        ([label, value]) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </>
                )}
                {(currentTabValue === 'helpful-links' ||
                    currentTabValue === 'favorites') && (
                    <Select
                        value={sortQuery}
                        onValueChange={(v) => setSortQuery(v)}
                    >
                        <SelectTrigger className="w-52">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(FilterOpenContent).map(
                                ([label, value]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                )
                            )}
                        </SelectContent>
                    </Select>
                )}
                <div className="ml-auto flex items-center gap-3">
                    <div className="flex border border-gray-200 rounded-md">
                        <Button
                            variant={
                                activeView === ViewType.Grid
                                    ? 'default'
                                    : 'ghost'
                            }
                            size="sm"
                            className={
                                activeView === ViewType.Grid
                                    ? 'bg-[#203622] text-white'
                                    : ''
                            }
                            onClick={() => setActiveView(ViewType.Grid)}
                        >
                            <LayoutGrid className="size-4" />
                        </Button>
                        <Button
                            variant={
                                activeView === ViewType.List
                                    ? 'default'
                                    : 'ghost'
                            }
                            size="sm"
                            className={
                                activeView === ViewType.List
                                    ? 'bg-[#203622] text-white'
                                    : ''
                            }
                            onClick={() => setActiveView(ViewType.List)}
                        >
                            <List className="size-4" />
                        </Button>
                    </div>
                    {isAdmin && (
                        <Button
                            variant="outline"
                            onClick={handleSwitchView}
                        >
                            {isManagement
                                ? 'Preview Student View'
                                : 'Return to Admin View'}
                        </Button>
                    )}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList>
                    {tabOptions.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.name}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <Outlet
                context={{
                    activeView,
                    searchQuery,
                    filterVisibilityAdmin:
                        currentTabValue === 'videos'
                            ? filterVideoVisibilityAdmin
                            : filterLibraryVisibilityAdmin,
                    categoryQueryString,
                    sortQuery
                }}
            />
        </div>
    );
}
