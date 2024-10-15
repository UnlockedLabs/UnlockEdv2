import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import ULIComponent from './ULIComponent';

export default function VisibleHiddenToggle({
    visible,
    changeVisibility
}: {
    visible: boolean;
    changeVisibility: (visibilityStatus: boolean) => void;
}) {
    const toggleClass =
        'py-1 rounded-lg inline-flex items-center justify-center gap-2';
    return (
        <div
            className="bg-grey-1 rounded-lg border border-grey-2 w-full p-1 grid grid-cols-2 shadow-md justify-self-end"
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
