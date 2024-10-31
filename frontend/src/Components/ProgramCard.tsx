import { BookmarkIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkIconOutline } from '@heroicons/react/24/outline';
import LightGreenPill from './pill-labels/LightGreenPill';
import { MouseEvent } from 'react';
import { Program, ViewType } from '@/common';
import API from '@/api/api';

export default function ProgramCard({
    program,
    callMutate,
    view
}: {
    program: Program;
    callMutate: () => void;
    view?: ViewType;
}) {
    function updateFavorite(e: MouseEvent) {
        e.preventDefault();
        API.put(`programs/${program.id}/save`, {})
            .then(() => {
                callMutate();
            })
            .catch((error) => {
                console.log(error);
            });
    }

    const bookmark: JSX.Element = program.is_favorited ? (
        <BookmarkIcon className="h-5 text-primary-yellow" />
    ) : (
        <BookmarkIconOutline
            className={`h-5 ${view === ViewType.List ? 'text-header-text' : 'text-white'}`}
        />
    );

    const tagPills = program.tags.map((tag) => (
        <LightGreenPill key={tag.id}>{tag.value.toString()}</LightGreenPill>
    ));

    if (view === ViewType.List) {
        return (
            <a
                className="card bg-base-teal body-small p-6 flex flex-row items-center"
                href="#"
                onClick={(e) => e.preventDefault()}
            >
                <div className="flex flex-col justify-between gap-3">
                    <div className="flex flex-row gap-3 items-center">
                        <div onClick={(e) => updateFavorite(e)}>{bookmark}</div>
                        <h2>{program.name}</h2>
                        <p className="body">|</p>
                        <div className="flex flex-wrap gap-2">{tagPills}</div>
                    </div>
                    <p className="body-small h-[1rem] line-clamp-2 overflow-hidden">
                        {program.description}
                    </p>
                </div>
            </a>
        );
    } else {
        return (
            <div className="card card-compact bg-base-teal overflow-hidden relative">
                <div
                    className="absolute top-2 right-2 cursor-pointer"
                    onClick={(e) => updateFavorite(e)}
                >
                    {bookmark}
                </div>
                <div className="card-body gap-0.2">
                    <h3 className="card-title text-sm">{program.name}</h3>
                    <p className="body-small line-clamp-2">
                        {program.description}
                    </p>
                    <div className="flex flex-wrap py-1 mt-2 space-y-2 sm:space-y-0 gap-x-1 gap-y-2">
                        {tagPills}
                    </div>
                </div>
            </div>
        );
    }
}
