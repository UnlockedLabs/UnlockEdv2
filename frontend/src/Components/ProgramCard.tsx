import { BookmarkIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkIconOutline } from '@heroicons/react/24/outline';
import { MouseEvent } from 'react';
import { Program, ViewType } from '@/common';
import API from '@/api/api';
import { isAdministrator, useAuth } from '@/useAuth';
import ClampedText from './ClampedText';

export default function ProgramCard({
    program,
    callMutate,
    view
}: {
    program: Program;
    callMutate: () => void;
    view?: ViewType;
}) {
    const { user } = useAuth();
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

    let bookmark: JSX.Element = <></>;
    if (user && !isAdministrator(user)) {
        bookmark = program.is_favorited ? (
            <BookmarkIcon className="h-5 text-primary-yellow" />
        ) : (
            <BookmarkIconOutline
                className={`h-5 ${view === ViewType.List ? 'text-header-text' : ' text-grey-3'}`}
            />
        );
    }

    const enrollments = Math.round(Math.random() * 20);

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
                    </div>
                    <p className="body-small h-[1rem] line-clamp-2 overflow-hidden">
                        {program.description}
                    </p>
                    <p className="body-small">
                        {enrollments} student{enrollments == 1 ? '' : 's'}{' '}
                        enrolled
                    </p>
                    <p className="body-small">
                        Available in {program.facilities.length}{' '}
                        {program.facilities.length == 1
                            ? 'facility'
                            : 'facilities'}
                    </p>
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
                    <ClampedText as="h3" lines={1} className="body">
                        {program.name}
                    </ClampedText>
                    <ClampedText as={'p'} lines={4} className="body-small h-16">
                        {program.description}
                    </ClampedText>
                    <p className="body-small">
                        {enrollments} student{enrollments == 1 ? '' : 's'}{' '}
                        enrolled
                    </p>
                    <p className="body-small">
                        Available in {program.facilities.length}{' '}
                        {program.facilities.length == 1
                            ? 'facility'
                            : 'facilities'}
                    </p>
                </div>
            </div>
        );
    }
}
