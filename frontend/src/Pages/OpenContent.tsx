import {
    LibraryAdminVisibility,
    OpenContentTabs,
    Tab,
    Option,
    FilterOpenContent,
    FeatureAccess,
    VideoAdminVisibility
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
import { hasFeature, isAdministrator, useAuth } from '@/useAuth';
import { useTourContext } from '@/Context/TourContext';
import { targetToStepIndexMap } from '@/Components/UnlockEdTour';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import CategoryDropdownFilter from '@/Components/CategoryDropdownFilter';
import LibrarySearchResultsModal from '@/Components/LibrarySearchResultsModal';
import ToggleView from '@/Components/ToggleView';
import {
    closeModal,
    RequestContentModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';
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
            ...(user && hasFeature(user, FeatureAccess.HelpfulLinksAccess)
                ? [{ name: OpenContentTabs.LINKS, value: 'helpful-links' }]
                : []),
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
        if (currentTabValue === 'videos') {
            setVideoVisibilityAdmin(VideoAdminVisibility['All Videos']);
        } else if (currentTabValue === 'libraries') {
            setFilterLibraryVisibilityAdmin(
                LibraryAdminVisibility['All Libraries']
            );
        }
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
            }
        }
    }, [isManagement, tourState, setTourState]);

    const requestContentModal = useRef<HTMLDialogElement>(null);
    const thankYouModalRef = useRef<HTMLDialogElement>(null);
    const [activeView, setActiveView] = useSessionViewType('libraryView');

    function successRequestContent() {
        closeModal(requestContentModal);
        showModal(thankYouModalRef);
    }

    // Search handling
    const searchModalRef = useRef<HTMLDialogElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery] = useDebounceValue(searchTerm, 500);
    function Search() {
        if (currentTabValue === 'libraries' || currentTabValue === 'videos') {
            return (
                <div
                    onClick={() => {
                        showModal(searchModalRef);
                    }}
                    id="knowledge-center-search"
                >
                    <LibrarySearchBar
                        onSearchClick={() => showModal(searchModalRef)}
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
    const [filterLibraryVisibilityAdmin, setFilterLibraryVisibilityAdmin] =
        useState<LibraryAdminVisibility>(
            LibraryAdminVisibility['All Libraries']
        );
    const [filterVideoVisibilityAdmin, setVideoVisibilityAdmin] =
        useState<VideoAdminVisibility>(VideoAdminVisibility['All Videos']);
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
                                setState={setFilterLibraryVisibilityAdmin}
                            />
                        )}
                    </>
                );
            } else if (currentTabValue === 'videos') {
                return (
                    <>
                        <DropdownControl
                            setState={setSortQuery}
                            enumType={FilterOpenContent}
                        />
                        {isAdmin && isManagement && (
                            <DropdownControl
                                enumType={VideoAdminVisibility}
                                setState={setVideoVisibilityAdmin}
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
            isAdmin,
            isManagement,
            setCategoryQueryString,
            setSortQuery,
            categories,
            filterLibraryVisibilityAdmin,
            filterVideoVisibilityAdmin
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
                    ) : user &&
                      hasFeature(user, FeatureAccess.RequestContentAccess) ? (
                        <button
                            className="button"
                            onClick={() => showModal(requestContentModal)}
                        >
                            Request Content
                        </button>
                    ) : (
                        ' '
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
                        filterVisibilityAdmin:
                            currentTabValue === 'videos'
                                ? filterVideoVisibilityAdmin
                                : filterLibraryVisibilityAdmin,
                        categoryQueryString,
                        sortQuery
                    }}
                />
                <RequestContentModal
                    ref={requestContentModal}
                    successRequestContent={successRequestContent}
                />
                <LibrarySearchResultsModal
                    ref={searchModalRef}
                    searchPlaceholder={`Search`}
                    onModalClose={() => closeModal(searchModalRef)}
                    useInternalSearchBar={true}
                />
                <TextOnlyModal
                    ref={thankYouModalRef}
                    type={TextModalType.Information}
                    title={'Thank you'}
                    text={
                        'Thank you. We review all requests when considering new content.'
                    }
                    onSubmit={() => {}} //eslint-disable-line
                    onClose={() => closeModal(thankYouModalRef)}
                />
            </div>
        </div>
    );
}
