import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';

export default function SearchBar({
    searchTerm,
    searchPlaceholder,
    changeCallback
}: {
    searchTerm: string;
    searchPlaceholder?: string;
    changeCallback: (arg: string) => void;
}) {
    return (
        <label className="form-control">
            <div className="relative">
                <MagnifyingGlassIcon className="absolute top-1/2 right-2 transform -translate-y-1/2 w-5 h-5 text-secondary" />
                <input
                    type="text"
                    placeholder={searchPlaceholder ?? 'Search...'}
                    className="input input-bordered w-full max-w-xs"
                    value={searchTerm}
                    onChange={(e) => changeCallback(e.target.value)}
                    autoFocus
                />
            </div>
        </label>
    );
}
