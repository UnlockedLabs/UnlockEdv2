import {
    SearchResult,
    PaginationMeta,
    ServerResponseMany,
    Option
} from '@/common';
import { CloseX, LibrarySearchBar, MultiSelectDropdown } from './inputs';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { forwardRef, useRef, useState, useEffect } from 'react';
import Pagination from './Pagination';
import API from '@/api/api';
import LibrarySearchResultCard from './cards/LibrarySearchResultCard';

interface LibrarySearchResultsModalProps {
    useInternalSearchBar?: boolean;
    searchPlaceholder?: string;
    libraryId?: number;
    onModalClose: () => void;
}

interface SearchEventPO {
    searchTerm: string;
    page: number;
    perPage: number;
}

const LibrarySearchResultsModal = forwardRef<
    HTMLDialogElement,
    LibrarySearchResultsModalProps
>(function SearchResultsModal(
    { searchPlaceholder = '', libraryId, onModalClose },
    ref
) {
    const { libraryOptions } = (useLoaderData() as {
        libraryOptions: Option[];
    }) || { libraryOptions: [] };
    const navigate = useNavigate();
    const [selectedOptions, setSelectedOptions] = useState<number[]>(
        libraryId ? [libraryId] : []
    );
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [placeholder, setPlaceholder] = useState<string>(searchPlaceholder);
    const [isSearchValid, setIsSearchValid] = useState<boolean>(false);
    const searchBarRef = useRef<HTMLInputElement>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [changesSinceLastSuggestion, setChangesSinceLastSuggestion] =
        useState(0);

    useEffect(() => {
        if (ref && typeof ref !== 'function' && ref.current?.open) {
            searchBarRef.current?.focus();
        }
    }, [ref]);

    const handleTermChange = (val: string) => {
        setSearchTerm(val);
        const trimmed = val.trim();
        setIsSearchValid(trimmed !== '');
        if (!trimmed) {
            setSuggestions([]);
            setChangesSinceLastSuggestion(0);
            return;
        }
        const words = trimmed.split(/\s+/);
        // trigger suggestions if there's more than one word or the first word's length is greater than 8
        if (words.length > 1 || words[0].length > 8) {
            if (suggestions.length !== 0) {
                // if we already have suggested something, we wait for 8 character changes before suggesting again
                setChangesSinceLastSuggestion(changesSinceLastSuggestion + 1);
                if (changesSinceLastSuggestion % 8 !== 0) return;
            }
            void handleSuggestQueries();
        }
    };

    const EmptyResult = {
        title: 'Search',
        link: '',
        book: '',
        thumbnail_url: '',
        description: '',
        total_results: '0',
        start_index: '0',
        items_per_page: '10',
        items: []
    };
    const [searchResults, setSearchResults] =
        useState<SearchResult>(EmptyResult);
    const [meta, setMeta] = useState<PaginationMeta>({
        current_page: 1,
        per_page: 10,
        total: 0,
        last_page: 0
    });
    const [isLoading, setIsLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    type SuggestionResponse = [
        originalQuery: string,
        suggestions: string[],
        extra: unknown[],
        metadata: {
            'google:suggestsubtypes': number[][];
        }
    ];
    const handleSuggestQueries = async () => {
        setSuggestions([]);
        if (!searchTerm.trim()) return;
        try {
            const res = await fetch(
                `/api/open-content/suggestions?query=${encodeURIComponent(searchTerm)}`
            );
            const data = (await res.json()) as SuggestionResponse;
            setSuggestions(data[1]);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSearch = async (
        page: number,
        perPage: number,
        term: string = searchTerm
    ) => {
        if (ref && typeof ref !== 'function') {
            if (ref.current?.open) {
                searchResults.items = []; // clear results on pagination, prevents jumpiness
            }
        }
        setIsLoading(true);
        setSearchError(null);
        const libraryIDs =
            selectedOptions.length > 0
                ? selectedOptions
                : libraryId
                  ? [libraryId]
                  : [];
        const urlParams = libraryIDs
            .map((libID) => `library_id=${libID}`)
            .join('&');
        try {
            const response = (await API.get(
                `open-content/search?search=${term}&${urlParams}&page=${page}&per_page=${perPage}`
            )) as ServerResponseMany<SearchResult>;
            if (response.success) {
                if (response.data[0].items?.length === 0) {
                    await handleSuggestQueries();
                    return;
                }
                setMeta(response.meta);
                setSearchResults(response.data[0]);
            } else {
                setSearchError(
                    'The search could not be completed due to an unexpected error. Please try again later.'
                );
            }
        } catch {
            setSearchError(
                'The search could not be completed due to a technical issue. Please try again later.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const scrollToTop = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    };
    const handleSetPage = (page: number) => {
        scrollToTop();
        void handleSearch(page, Number(searchResults.items_per_page));
    };
    const handleSetPerPage = (perPage: number) => {
        scrollToTop();
        void handleSearch(1, perPage);
    };
    const handleOnBlurSearch = () => {
        if (selectedOptions.length > 0) {
            if (searchTerm.trim() === '') {
                return;
            }
            void handleSearch(1, 10);
        }
    };
    const handleSelectionChange = (selected: number[]) => {
        if (selected.length > 1) {
            setPlaceholder('Search Libraries...');
        }
        setSelectedOptions(selected);
    };
    const parseNumber = (num: string) => {
        return Number(num.replace(/,/g, ''));
    };
    const currentEndResultsPage = Math.min(
        Number(parseNumber(searchResults.start_index)) +
            Number(searchResults.items_per_page) -
            1,
        parseNumber(searchResults.total_results)
    );
    const currentPageDisplay = `Results ${searchResults.start_index}-${currentEndResultsPage.toLocaleString(
        'en-US'
    )} of ${searchResults.total_results}`;
    useEffect(() => {
        // Used for externally hooking an event call to execute search.
        const executeSearchListener = (event: CustomEvent<SearchEventPO>) => {
            const { searchTerm, page, perPage } = event.detail;
            setSearchTerm(searchTerm);
            setIsSearchValid(searchTerm.trim() !== '');
            void handleSearch(page, perPage, searchTerm);
        };

        if (ref && typeof ref !== 'function') {
            ref.current?.addEventListener(
                'executeHandleSearch',
                executeSearchListener as EventListener
            );

            return () => {
                ref.current?.removeEventListener(
                    'executeHandleSearch',
                    executeSearchListener as EventListener
                );
            };
        }
    }, [ref, handleSearch]);
    const handleCloseModal = () => {
        setSearchTerm('');
        onModalClose();
        setSearchResults(EmptyResult);
        setSuggestions([]);
    };

    const navToViewer = (
        kind: string,
        url: string,
        title: string,
        id: number
    ) => {
        switch (kind) {
            case 'library':
                navigate(`/viewer/libraries/${id}`, {
                    state: { url: url, title: title }
                });
                break;
            case 'video':
                navigate(url);
        }
        handleCloseModal();
    };

    return (
        <dialog ref={ref} className="modal" onClose={handleCloseModal}>
            <div className="w-[1200px] h-[700px] bg-background rounded-lg shadow-lg flex flex-col">
                <div className="sticky top-0 bg-background z-50 p-4 border-b border-grey-2 rounded-t-lg">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <h2 className="text-2xl">{searchResults.title}</h2>
                            <p className="body">{currentPageDisplay}</p>
                        </div>
                        <LibrarySearchBar
                            searchTerm={searchTerm}
                            isSearchValid={isSearchValid}
                            searchPlaceholder={placeholder}
                            changeCallback={handleTermChange}
                            onSearchClick={() => void handleSearch(1, 10)}
                            ref={searchBarRef}
                        />
                        {searchTerm.trim() && !searchResults?.items?.length && (
                            <button
                                type="button"
                                onClick={() => void handleSuggestQueries()}
                                className="button"
                            >
                                Suggestions
                            </button>
                        )}
                        <MultiSelectDropdown
                            label="Select Libraries"
                            options={libraryOptions}
                            selectedOptions={selectedOptions}
                            onSelectionChange={handleSelectionChange}
                            onBlurSearch={handleOnBlurSearch}
                        />
                        <CloseX close={onModalClose} />
                    </div>
                    {suggestions.length > 0 && (
                        <div className="relative mt-2 p-2 bg-grey-1 rounded">
                            <button
                                onClick={() => setSuggestions([])}
                                className="button-circle absolute top-1 right-1"
                            >
                                x
                            </button>
                            <p className="mb-1 text-sm font-semibold">
                                Did you mean:
                            </p>
                            <ul className="flex flex-wrap gap-2">
                                {suggestions.map((sug, index) => (
                                    <li key={index}>
                                        <button
                                            type="button"
                                            className="button-grey-sm"
                                            onClick={() => {
                                                setSearchTerm(sug);
                                                setSuggestions([]);
                                                void handleSearch(1, 10, sug);
                                            }}
                                        >
                                            {sug}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                <div
                    ref={scrollContainerRef}
                    className="flex flex-col gap-4 overflow-y-auto p-4 scrollbar"
                >
                    {searchResults.items?.map((item, index) => (
                        <LibrarySearchResultCard
                            key={index}
                            item={item}
                            onItemClick={navToViewer}
                        />
                    ))}
                </div>
                {isLoading ? (
                    <div className="flex h-screen gap-4 justify-center content-center">
                        <span className="my-auto loading loading-spinner loading-lg"></span>
                        <p className="my-auto text-lg">Loading...</p>
                    </div>
                ) : searchError ? (
                    <div className="flex h-screen gap-4 justify-center content-center">
                        <p className="my-auto text-lg text-error">
                            {searchError}
                        </p>
                    </div>
                ) : searchResults.title === 'Search' ? (
                    <div className="flex h-screen gap-4 justify-center content-center">
                        <p className="my-auto text-lg">
                            Press 'Enter' to search
                        </p>
                    </div>
                ) : searchResults.items && searchResults.items.length === 0 ? (
                    <div className="flex h-screen gap-4 justify-center content-center">
                        <p className="my-auto text-lg">No Results Found</p>
                    </div>
                ) : (
                    ' '
                )}
                <div className="border-t border-grey-2 px-6 py-4 flex justify-center rounded-b-lg">
                    <Pagination
                        meta={meta}
                        setPage={handleSetPage}
                        setPerPage={handleSetPerPage}
                    />
                </div>
            </div>
        </dialog>
    );
});
export default LibrarySearchResultsModal;
