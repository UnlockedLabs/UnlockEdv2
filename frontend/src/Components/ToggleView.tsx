import { ListBulletIcon, Squares2X2Icon } from '@heroicons/react/24/solid';
import { SetStateAction } from 'react';
import { ViewType } from '@/common';

export default function ToggleView({
    activeView,
    setActiveView
}: {
    activeView: ViewType;
    setActiveView: (state: SetStateAction<ViewType>) => void;
}) {
    return (
        <div className="flex flex-row items-center gap-2">
            <label className="text-md">View</label>
            <div className="bg-teal-1 join p-1">
                {/* TO DO: come back and render on active or not */}
                <button
                    className={`flex gap-2 px-3 py-1 items-center rounded-lg ${activeView == ViewType.Grid && 'bg-background'}`}
                    onClick={() => setActiveView(ViewType.Grid)}
                >
                    <Squares2X2Icon className="h-4"></Squares2X2Icon> Grid
                </button>
                <button
                    className={`flex gap-2 px-3 py-1 items-center rounded-lg ${activeView == ViewType.List && 'bg-background'}`}
                    onClick={() => setActiveView(ViewType.List)}
                >
                    <ListBulletIcon className="h-4"></ListBulletIcon> List
                </button>
            </div>
        </div>
    );
}
