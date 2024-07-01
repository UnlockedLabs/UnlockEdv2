import { PaginationMeta } from "@/common";
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/solid";

export default function Pagination({
  meta,
  setPage,
}: {
  meta: PaginationMeta;
  setPage: (page: number) => void;
}) {
  const page = meta.current_page - 1;

  return (
    <div className="join place-content-center">
      <div
        className={`${page > 0 ? "tooltip tooltip-left" : ""}`}
        data-tip="First Page"
      >
        <button
          disabled={page == 0}
          className="join-item btn btn-sm"
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
                i == meta.current_page - 1 ? "btn-active" : ""
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
          page != meta.last_page - 1 ? "tooltip tooltip-right" : ""
        }`}
        data-tip="Last Page"
      >
        <button
          className="join-item btn btn-sm"
          onClick={() => setPage(meta.last_page)}
          disabled={page == meta.last_page - 1}
        >
          <ChevronDoubleRightIcon className="h-4" />
        </button>
      </div>
    </div>
  );
}
