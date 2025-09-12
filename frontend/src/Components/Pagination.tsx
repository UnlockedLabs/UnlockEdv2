import { PaginationMeta } from '@/common';
import {
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon
} from '@heroicons/react/24/solid';

export default function Pagination({
    meta,
    setPage,
    setPerPage,
    specialPageSelecton,
    forceShow
}: {
    meta: PaginationMeta;
    setPage: (page: number) => void;
    setPerPage?: (perPage: number) => void;
    specialPageSelecton?: boolean;
    forceShow?: boolean;
}) {
    if (!meta || (meta.total <= meta.per_page && !forceShow)) {
        return null;
    }

    const page = meta.current_page - 1;
    const perPage = meta.per_page;
    const perPageSelections = specialPageSelecton
        ? [12, 24, 60, 120]
        : [10, 20, 50, 100];
    return (
        <div className="flex items-center justify-center flex-wrap">
            <div className="join">
                <button
                    data-tip="First Page"
                    disabled={page == 0}
                    className={`join-item button-grey-sm rounded-l ${page > 0 ? 'tooltip tooltip-left' : ''}`}
                    onClick={() => setPage(1)}
                >
                    <ChevronDoubleLeftIcon className="h-5" />
                </button>

                {[page - 2, page - 1, page, page + 1, page + 2]
                    .filter((i) => i >= 0 && i < meta.last_page)
                    .map((i) => {
                        return (
                            <button
                                className={`join-item ${
                                    i == meta.current_page - 1
                                        ? 'button-grey-sm-active'
                                        : 'button-grey-sm'
                                }`}
                                onClick={() => setPage(i + 1)}
                                key={i}
                            >
                                {i + 1}
                            </button>
                        );
                    })}

                <button
                    data-tip="Last Page"
                    disabled={page == meta.last_page - 1}
                    className={`join-item button-grey-sm ${page != meta.last_page - 1 ? 'tooltip tooltip-right' : ''} ${page >= meta.last_page - 3 ? 'rounded-r' : ''}`}
                    onClick={() => setPage(meta.last_page)}
                >
                    <ChevronDoubleRightIcon className="h-5" />
                </button>
            </div>
            {setPerPage && (
                <div
                    className="tooltip tooltip-right"
                    data-tip="Items per page"
                >
                    <div className="flex-col-1 pl-3 align-middle">
                        <div className="dropdown dropdown-hover dropdown-top">
                            <div
                                tabIndex={0}
                                role="button"
                                className="button-grey-sm"
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
