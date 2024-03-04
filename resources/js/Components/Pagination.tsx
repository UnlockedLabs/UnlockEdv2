import {
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
} from "@heroicons/react/24/solid";

interface PaginationMeta {
    current_page: number;
    total: number;
    from: number;
    to: number;
    last_page: number;
    per_page: number;
}

export interface PaginatedData<T> {
    data: Array<T>;
    meta: PaginationMeta;
}

export default function Pagination({
    meta,
    setPage,
}: {
    meta: PaginationMeta;
    setPage: (page: number) => void;
}) {
    return (
        <div className="join place-content-center">
            <div className="tooltip tooltip-left" data-tip="First Page">
                <button
                    className="join-item btn btn-sm"
                    onClick={() => setPage(meta.from)}
                >
                    <ChevronDoubleLeftIcon className="h-4" />
                </button>
            </div>

            {[...Array(meta.last_page).keys()].map((_, i) => {
                return (
                    <button
                        className={`join-item btn btn-sm ${
                            i == meta.current_page - 1 ? "btn-active" : ""
                        }`}
                        onClick={() => setPage(i + 1)}
                        key={i}
                    >
                        {i + 1}
                    </button>
                );
            })}

            <div className="tooltip tooltip-right" data-tip="Last Page">
                <button
                    className="join-item btn btn-sm"
                    onClick={() => setPage(meta.to)}
                >
                    <ChevronDoubleRightIcon className="h-4" />
                </button>
            </div>
        </div>
    );
}
