import { BookmarkIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkIconOutline } from '@heroicons/react/24/outline';
import LightGreenPill from './pill-labels/LightGreenPill';
import { MouseEvent } from 'react';
import { Facility, Program, ViewType } from '@/common';
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

    const getFacilitiesList = () => {
        return program.facilities.map((facility: Facility, idx: number) => {
            if (idx === program.facilities.length - 1) {
                return facility.name;
            } else {
                return facility.name + ', ';
            }
        });
    };

    const bookmark: JSX.Element = program.is_favorited ? (
        <BookmarkIcon className="h-5 text-primary-yellow" />
    ) : (
        <BookmarkIconOutline
            className={`h-5 ${view === ViewType.List ? 'text-header-text' : ' text-grey-3'}`}
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
                    <p className="body">Available in Facilities:</p>
                    <p className="body">{getFacilitiesList()}</p>
                </div>
            </a>
        );
    } else {
        return (
            <div className="card bg-base-teal overflow-hidden relative">
                <div
                    className="absolute top-2 right-2 cursor-pointer"
                    onClick={(e) => updateFavorite(e)}
                >
                    {bookmark}
                </div>
                <div className="p-4 gap-2 flex flex-col columns-4">
                    <h3 className="text-sm">{program.name}</h3>
                    <p className="body-small line-clamp-4 h-16">
                        {program.description}
                    </p>
                    <p className="body font-bold">Available in Facilities:</p>
                    <p>{getFacilitiesList()}</p>
                    <div className="flex flex-auto gap-2">{tagPills}</div>
                </div>
            </div>
        );
    }
}
