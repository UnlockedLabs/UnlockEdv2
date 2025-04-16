import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { forwardRef, startTransition } from 'react';

interface LibrarySearchBarProps {
    searchTerm: string;
    isSearchValid: boolean;
    searchPlaceholder: string;
    changeCallback: (arg: string) => void;
    onSearchClick: (page: number, perPage: number) => void; //default to 10
}

export const LibrarySearchBar = forwardRef<
    HTMLInputElement,
    LibrarySearchBarProps
>(function SearchResultsModal(
    {
        searchTerm,
        isSearchValid,
        searchPlaceholder,
        changeCallback,
        onSearchClick
    },
    ref
) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && isSearchValid) {
            e.preventDefault();
            onSearchClick(1, 10);
        }
    };
    return (
        <label className="form-control">
            <div className="relative">
                <button
                    type="button"
                    onClick={() => onSearchClick(1, 10)}
                    className="absolute top-1/2 right-2 transform -translate-y-1/2 focus:outline-none hover:text-primary"
                    disabled={!isSearchValid}
                >
                    <MagnifyingGlassIcon className="absolute top-1/2 right-2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
                </button>
                <input
                    {...(ref ? { ref } : { autoFocus: false })}
                    type="text"
                    placeholder={searchPlaceholder}
                    className="input input-bordered w-full max-w-xs"
                    value={searchTerm}
                    onChange={(e) => {
                        startTransition(() => {
                            changeCallback(e.target.value);
                        });
                    }}
                    onKeyDown={handleKeyDown}
                />
            </div>
        </label>
    );
});
