import {
    LibraryAdminVisibility,
    OpenContentTabs,
    Tab,
    Option,
    FilterLibrariesVidsandHelpfulLinksResident
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

export default function OpenContent() {
    const { setPageTitle: setAuthLayoutPageTitle } = usePageTitle();
    const navigate = useNavigate();
    const { user } = useAuth();
    const route = useLocation();
    const currentTabValue = route.pathname.split('/')[2] ?? 'libraries';
    const tabOptions: Tab[] = [
        { name: OpenContentTabs.KIWIX, value: 'libraries' },
        { name: OpenContentTabs.VIDEOS, value: 'videos' },
        { name: OpenContentTabs.LINKS, value: 'helpful-links' },
        { name: OpenContentTabs.FAVORITES, value: 'favorites' }
    ];
    const [activeTab, setActiveTab] = useState<Tab>(
        tabOptions.find((t) => t.value === currentTabValue) ?? tabOptions[0]
    );
    const { tourState, setTourState } = useTourContext();
    const requestContentModal = useRef<HTMLDialogElement>(null);
    const [activeView, setActiveView] = useSessionViewType('libraryView');
    //search
    const searchModalRef = useRef<HTMLDialogElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    // filters
    const { categories } = useLoaderData() as {
        categories: Option[];
    };
    const [filterVisibilityAdmin, setFilterVisibilityAdmin] = useState<string>(
        LibraryAdminVisibility['All Libraries']
    );
    const [categoryQueryString, setCategoryQueryString] = useState<string>('');
    const [sortQuery, setSortQuery] = useState<string>(
        FilterLibrariesVidsandHelpfulLinksResident['Title (A to Z)']
    );

    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };

    useEffect(() => {
        setAuthLayoutPageTitle(activeTab.value as string);
    }, [activeTab]);

    const handlePageChange = (tab: Tab) => {
        navigate(`/knowledge-center/${String(tab.value).toLowerCase()}`);
        setActiveTab(tab);
    };
    const handleReturnToAdminView = () => {
        if (currentTabValue === 'favorites') {
            navigate('/knowledge-center-management/libraries');
        } else if (
            currentTabValue === 'libraries' ||
            currentTabValue === 'videos' ||
            currentTabValue === 'helpful-links'
        ) {
            navigate('/knowledge-center-management/' + currentTabValue);
        }
    };

    useEffect(() => {
        if (tourState.tourActive) {
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
        } else {
            setTourState(initialTourState);
        }
    }, []);

    const DropdownFilter = useMemo(
        function () {
            if (currentTabValue === 'libraries') {
                return (
                    <>
                        {isAdministrator(user) && !adminWithStudentView() && (
                            <DropdownControl
                                enumType={LibraryAdminVisibility}
                                setState={setFilterVisibilityAdmin}
                            />
                        )}
                        <div id="knowledge-center-filters">
                            <CategoryDropdownFilter
                                mutate={() =>
                                    console.log(
                                        'updating category dropdown filter'
                                    )
                                }
                                setCategoryQueryString={setCategoryQueryString}
                                options={categories}
                            />
                        </div>
                    </>
                );
            } else {
                return (
                    <DropdownControl
                        setState={setSortQuery}
                        enumType={FilterLibrariesVidsandHelpfulLinksResident}
                    />
                );
            }
        },
        [
            currentTabValue,
            user,
            setFilterVisibilityAdmin,
            setCategoryQueryString,
            setSortQuery,
            categories
        ]
    );

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
                    {user && isAdministrator(user) ? (
                        <button
                            className="button-outline"
                            onClick={() => handleReturnToAdminView()}
                        >
                            Return to Admin View
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
            <div className="flex flex-col gap-8 py-8">
                <Outlet
                    context={{
                        activeView,
                        searchTerm,
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
