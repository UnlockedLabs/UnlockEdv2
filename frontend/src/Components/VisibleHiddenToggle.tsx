import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import ULIComponent from './ULIComponent';
import { ViewType } from '@/common';

export default function VisibleHiddenToggle({
    visible,
    changeVisibility,
    view
}: {
    visible: boolean;
    changeVisibility: (visibilityStatus: boolean) => void;
    view?: ViewType;
}) {
    const toggleClass =
        view === ViewType.List
            ? 'flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-base'
            : 'flex-1 px-2 py-1 rounded-lg flex items-center justify-center gap-1 text-xs';

    const containerClass =
        view === ViewType.Grid
            ? 'grid grid-cols-2 w-full'
            : 'inline-flex w-fit ';
    return (
        <div
            className={`bg-grey-1 rounded-lg border border-grey-2 p-1 shadow-md ${containerClass}`}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                className={`${toggleClass} ${visible ? 'bg-teal-3 text-white' : 'bg-transparent'}`}
                onClick={() => changeVisibility(true)}
            >
                <ULIComponent icon={CheckCircleIcon} />
                <label className="body-small cursor-pointer">VISIBLE</label>
            </button>
            <button
                className={`${toggleClass} ${visible ? 'bg-transparent' : 'bg-error text-white'}`}
                onClick={() => changeVisibility(false)}
            >
                <ULIComponent icon={XCircleIcon} />
                <label className="body-small cursor-pointer">HIDDEN</label>
            </button>
        </div>
    );
}
