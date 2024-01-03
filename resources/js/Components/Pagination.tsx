import {
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
} from "@heroicons/react/24/solid";

interface PaginationLinks {
    first: string;
    last: string;
}

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
    links: PaginationLinks;
    meta: PaginationMeta;
}

export default function Pagination({
    links,
    meta,
}: {
    links: PaginationLinks;
    meta: PaginationMeta;
}) {
    return (
        <div className="join place-content-center">
            <div className="tooltip tooltip-left" data-tip="First Page">
                <button className="join-item btn btn-sm">
                    <ChevronDoubleLeftIcon className="h-4" />
                </button>
            </div>

            {[...Array(meta.total).keys()].map((_, i) => {
                return i == meta.current_page - 1 ? (
                    <button className="join-item btn btn-sm btn-active">
                        {i + 1}
                    </button>
                ) : (
                    <button className="join-item btn btn-sm">{i + 1}</button>
                );
            })}

            <div className="tooltip tooltip-right" data-tip="Last Page">
                <button className="join-item btn btn-sm">
                    <ChevronDoubleRightIcon className="h-4" />
                </button>
            </div>
        </div>
    );
}
