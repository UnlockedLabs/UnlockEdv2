import { BookmarkIcon } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkIconOutline } from '@heroicons/react/24/outline';
import { MouseEvent } from 'react';
import { Program, ViewType } from '@/common';
import API from '@/api/api';
import { isAdministrator, useAuth } from '@/useAuth';
import ClampedText from './ClampedText';
import { useNavigate } from 'react-router-dom';

export default function ProgramCard({
    program,
    callMutate,
    view = ViewType.Grid
}: {
    program: Program;
    callMutate: () => void;
    view?: ViewType;
}) {
    const { user } = useAuth();
    const navigate = useNavigate();

    function updateFavorite(e: MouseEvent) {
        e.stopPropagation(); // Prevent card navigation when clicking the favorite icon
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
                className={`h-5 ${view === ViewType.List ? 'text-header-text' : 'text-grey-3'}`}
            />
        );
    }

    // For demo purposes
    const enrollments = Math.round(Math.random() * 20);

    if (view === ViewType.List) {
        return (
            <div
                className="card bg-base-teal body-small p-6 flex flex-row items-center cursor-pointer"
                onClick={() => navigate(`${program.id}`)}
            >
                <div className="flex flex-col justify-between gap-3">
                    <div className="flex flex-row gap-3 items-center">
                        {/* Clicking this icon will only update favorite, not trigger navigation */}
                        <div onClick={(e) => updateFavorite(e)}>{bookmark}</div>
                        <h2>{program.name}</h2>
                        <p className="body">|</p>
                    </div>
                    <p className="body-small h-[1rem] line-clamp-2 overflow-hidden">
                        {program.description}
                    </p>
                    <p className="body-small">
                        {enrollments} student{enrollments === 1 ? '' : 's'}{' '}
                        enrolled
                    </p>
                    <p className="body-small">
                        Available in {program.facilities.length}{' '}
                        {program.facilities.length === 1
                            ? 'facility'
                            : 'facilities'}
                    </p>
                </div>
            </div>
        );
    }

    // Grid view uses the main branch layout plus navigation on click
    return (
        <div
            className="card bg-base-teal overflow-hidden relative cursor-pointer"
            onClick={() => navigate(`${program.id}`)}
        >
            <div
                className="absolute top-2 right-2 cursor-pointer"
                onClick={updateFavorite}
            >
                {bookmark}
            </div>
            <div className="p-4 gap-2 flex flex-col columns-4">
                <ClampedText as="h3" lines={1} className="body">
                    {program.name}
                </ClampedText>
                <ClampedText as="p" lines={4} className="body-small h-16">
                    {program.description}
                </ClampedText>
                <p className="body-small">
                    {enrollments} student{enrollments === 1 ? '' : 's'} enrolled
                </p>
                <p className="body-small">
                    Available in {program.facilities.length}{' '}
                    {program.facilities.length === 1
                        ? 'facility'
                        : 'facilities'}
                </p>
            </div>
        </div>
    );
}
