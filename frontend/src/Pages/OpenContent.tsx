import {
    LibraryAdminVisibility,
    OpenContentTabs,
    Tab,
    Option,
    FilterOpenContent
} from '@/common';
import { usePageTitle } from '@/Context/AuthLayoutPageTitleContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import TabView from '@/Components/TabView';
import {
    useNavigate,
    Outlet,
    useLocation,
    useLoaderData
} from 'react-router-dom';
import { isAdministrator, useAuth } from '@/useAuth';
import { initialTourState, useTourContext } from '@/Context/TourContext';
import { targetToStepIndexMap } from '@/Components/UnlockEdTour';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import CategoryDropdownFilter from '@/Components/CategoryDropdownFilter';
import LibrarySearchResultsModal from '@/Components/LibrarySearchResultsModal';
import ToggleView from '@/Components/ToggleView';
import { RequestContentModal } from '@/Components/modals';
import { useSessionViewType } from '@/Hooks/sessionView';
import { LibrarySearchBar } from '@/Components/inputs';
import { useDebounceValue } from 'usehooks-ts';

export default function OpenContent() {
    const { setPageTitle: setAuthLayoutPageTitle } = usePageTitle();
    const navigate = useNavigate();
    const { user } = useAuth();
    const route = useLocation();

    // Determine if we're in management (admin) mode
    const isAdmin = isAdministrator(user);
    const isManagement = route.pathname.startsWith(
        '/knowledge-center-management'
    );
    const basePath = isManagement
        ? '/knowledge-center-management'
        : '/knowledge-center';

    // Tab handling
    const tabOptions = useMemo(
        () => [
            { name: OpenContentTabs.KIWIX, value: 'libraries' },
            { name: OpenContentTabs.VIDEOS, value: 'videos' },
            { name: OpenContentTabs.LINKS, value: 'helpful-links' },
            ...(!isManagement
                ? [{ name: OpenContentTabs.FAVORITES, value: 'favorites' }]
                : [])
        ],
        [isManagement]
    );
    const currentTabValue = route.pathname.split('/')[2] ?? 'libraries';
    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions.find((t) => t.value === currentTabValue) ?? tabOptions[0]
    );
    useEffect(() => {
        setActiveTab(
            tabOptions.find((t) => t.value === currentTabValue) ?? tabOptions[0]
        );
        setFilterVisibilityAdmin(LibraryAdminVisibility['All Libraries']);
        setSortQuery(FilterOpenContent['Title (A to Z)']);
        setSearchTerm('');
    }, [route.pathname, tabOptions]);
    useEffect(() => {
        setAuthLayoutPageTitle(activeTab.value as string);
    }, [activeTab, setAuthLayoutPageTitle]);
    const handlePageChange = (tab: Tab) => {
        navigate(`${basePath}/${String(tab.value).toLowerCase()}`);
        setActiveTab(tab);
    };

    // Button handling (switch between admin and student views)
    const handleSwitchView = () => {
        if (!isAdmin) return;
        if (isManagement) {
            navigate(`/knowledge-center/${activeTab.value}`);
        } else {
            if (activeTab.value === 'favorites') {
                navigate('/knowledge-center-management/libraries');
            } else {
                navigate(`/knowledge-center-management/${activeTab.value}`);
            }
        }
    };

    // Tour logic (only in student view)
    const { tourState, setTourState } = useTourContext();
    useEffect(() => {
        if (!isManagement && tourState?.tourActive) {
            if (tourState.target === '#library-viewer-sub-page') {
                setTourState({
                    stepIndex:
                        targetToStepIndexMap['#knowledge-center-fav-lib'],
                    target: '#knowledge-center-fav-lib'
                });
            } else {
                setTourState({
                    stepIndex:
                        targetToStepIndexMap['#knowledge-center-landing'],
                    target: '#knowledge-center-landing'
                });
            }
        } else if (tourState.target !== initialTourState.target) {
            setTourState(initialTourState);
        }
    }, [isManagement, tourState, setTourState]);

    const requestContentModal = useRef<HTMLDialogElement>(null);
    const [activeView, setActiveView] = useSessionViewType('libraryView');

    // Search handling
    const searchModalRef = useRef<HTMLDialogElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery] = useDebounceValue(searchTerm, 500);
    function Search() {
        if (currentTabValue === 'libraries' || currentTabValue === 'videos') {
            return (
                <div
                    onClick={() => {
                        searchModalRef.current?.showModal();
                    }}
                    id="knowledge-center-search"
                >
                    <LibrarySearchBar
                        onSearchClick={() =>
                            searchModalRef.current?.showModal()
                        }
                        searchPlaceholder="Search..."
                        searchTerm={searchTerm}
                        changeCallback={setSearchTerm}
                        isSearchValid={searchTerm.trim() !== ''}
                    />
                </div>
            );
        }
        if (
            currentTabValue === 'helpful-links' ||
            currentTabValue === 'favorites'
        ) {
            return (
                <SearchBar
                    searchTerm={searchTerm}
                    changeCallback={setSearchTerm}
                />
            );
        }
    }

    // Filter dropdown handling
    const { categories } = useLoaderData() as {
        categories: Option[];
    };
    const [filterVisibilityAdmin, setFilterVisibilityAdmin] = useState<string>(
        LibraryAdminVisibility['All Libraries']
    );
    const [categoryQueryString, setCategoryQueryString] = useState<string>('');
    const [sortQuery, setSortQuery] = useState<string>(
        FilterOpenContent['Title (A to Z)']
    );
    const DropdownFilter = useMemo(
        function () {
            if (currentTabValue === 'libraries') {
                return (
                    <>
                        <div id="knowledge-center-filters">
                            <CategoryDropdownFilter
                                mutate={() => {}} // eslint-disable-line
                                setCategoryQueryString={setCategoryQueryString}
                                options={categories}
                            />
                        </div>
                        {isAdmin && isManagement && (
                            <DropdownControl
                                enumType={LibraryAdminVisibility}
                                setState={setFilterVisibilityAdmin}
                            />
                        )}
                    </>
                );
            } else {
                return (
                    <DropdownControl
                        setState={setSortQuery}
                        enumType={FilterOpenContent}
                    />
                );
            }
        },
        [
            currentTabValue,
            user,
            setCategoryQueryString,
            setSortQuery,
            categories
        ]
    );

    return (
        <div className="px-5 pb-4" id="knowledge-center-landing">
            <div className="flex flex-row gap-4 pb-4">
                <Search />
                {DropdownFilter}
                <div className="ml-auto flex flex-row gap-4">
                    <ToggleView
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                    {user && isAdmin ? (
                        <button
                            className="button-outline"
                            onClick={handleSwitchView}
                        >
                            {isManagement
                                ? 'Preview Student View'
                                : 'Return to Admin View'}
                        </button>
                    ) : (
                        <button
                            className="button"
                            onClick={() =>
                                requestContentModal.current?.showModal()
                            }
                        >
                            Request Content
                        </button>
                    )}
                </div>
            </div>
            <div id="knowledge-center-tabs">
                <TabView
                    tabs={tabOptions}
                    activeTab={activeTab}
                    setActiveTab={(tab) => {
                        void handlePageChange(tab);
                    }}
                />
            </div>
            <div className="flex flex-col gap-4 py-4">
                <Outlet
                    context={{
                        activeView,
                        searchQuery,
                        filterVisibilityAdmin,
                        categoryQueryString,
                        sortQuery
                    }}
                />
                <RequestContentModal ref={requestContentModal} />
                <LibrarySearchResultsModal
                    ref={searchModalRef}
                    searchPlaceholder={`Search`}
                    onModalClose={() => searchModalRef.current?.close()}
                    useInternalSearchBar={true}
                />
            </div>
        </div>
    );
}
