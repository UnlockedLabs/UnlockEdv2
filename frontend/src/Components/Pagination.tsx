import { PaginationMeta } from '@/common';
import {
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon
} from '@heroicons/react/24/solid';

export default function Pagination({
    meta,
    setPage,
    setPerPage
}: {
    meta: PaginationMeta;
    setPage: (page: number) => void;
    setPerPage?: (perPage: number) => void;
}) {
    const page = meta.current_page - 1;
    const perPage = meta.per_page;
    const perPageSelections = [10, 20, 50, 100];
    return (
        <div className="join place-content-center">
            <div
                className={`${page > 0 ? 'tooltip tooltip-left' : ''}`}
                data-tip="First Page"
            >
                <button
                    disabled={page == 0}
                    className="join-item btn btn-sm rounded-l"
                    onClick={() => setPage(1)}
                >
                    <ChevronDoubleLeftIcon className="h-4" />
                </button>
            </div>

            {[page - 2, page - 1, page, page + 1, page + 2]
                .filter((i) => i >= 0 && i < meta.last_page)
                .map((i) => {
                    return (
                        <button
                            className={`join-item btn btn-sm ${
                                i == meta.current_page - 1 ? 'btn-active' : ''
                            }`}
                            onClick={() => setPage(i + 1)}
                            key={i}
                        >
                            {i + 1}
                        </button>
                    );
                })}

            <div
                className={`${
                    page != meta.last_page - 1 ? 'tooltip tooltip-right' : ''
                }`}
                data-tip="Last Page"
            >
                <button
                    className="join-item btn btn-sm rounded-r"
                    onClick={() => setPage(meta.last_page)}
                    disabled={page == meta.last_page - 1}
                >
                    <ChevronDoubleRightIcon className="h-4" />
                </button>
            </div>
            {setPerPage && (
                <div
                    className="tooltip tooltip-right"
                    data-tip="Items per page"
                >
                    <div className="flex-col-1 pl-5 align-middle">
                        <div className="dropdown dropdown-hover dropdown-top">
                            <div
                                tabIndex={0}
                                role="button"
                                className="btn btn-sm"
                            >
                                {perPage}
                            </div>
                            <ul
                                tabIndex={0}
                                className="dropdown-content menu bg-base-100 rounded-box z-[1] w-30 p-2 shadow"
                            >
                                {perPageSelections.map((item) => (
                                    <li key={item}>
                                        <a
                                            onClick={() => {
                                                setPerPage(item);
                                            }}
                                        >
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
