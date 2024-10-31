import { useAuth } from '@/useAuth';
import { useState, useRef } from 'react';
import ProgramCard from '@/Components/ProgramCard';
import SearchBar from '@/Components/inputs/SearchBar';
import { Program, ServerResponse, ViewType, UserRole } from '@/common';
import useSWR from 'swr';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { AxiosError } from 'axios';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import ToggleView from '@/Components/ToggleView';

export default function Programs() {
    const { user } = useAuth();
    const addProgramModal = useRef<HTMLDialogElement>(null);

    if (!user) {
        return null;
    }

    const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);
    const [searchTerm, setSearchTerm] = useState('');
    const [order, setOrder] = useState('asc');
    const { data, error, mutate } = useSWR<ServerResponse<Program>, AxiosError>(
        `/api/programs?search=${searchTerm}&order=${order}`
    );
    const programData = data?.data as Program[];

    function handleSearch(newSearch: string) {
        setSearchTerm(newSearch);
    }

    return (
        <div className="px-8 py-4">
            <div className="flex flex-row justify-between items-center mb-4">
                <div className="flex flex-row items-center space-x-4">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleSearch}
                    />
                    <DropdownControl
                        label="order"
                        setState={setOrder}
                        enumType={{
                            Ascending: 'asc',
                            Descending: 'desc'
                        }}
                    />
                </div>
                <div className="flex items-center space-x-4">
                    <ToggleView
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                    {user.role === UserRole.Admin && (
                        <button
                            className="button flex items-center space-x-2"
                            onClick={() => {
                                addProgramModal.current?.showModal();
                            }}
                        >
                            <PlusCircleIcon className="w-4 my-auto" />
                            <span>Add Program</span>
                        </button>
                    )}
                </div>
            </div>
            <div
                className={`mt-8 ${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
            >
                {error ? (
                    <p className="text-error">Error loading programs.</p>
                ) : programData?.length === 0 ? (
                    <p className="text-error">No programs to display.</p>
                ) : (
                    programData?.map((program: Program) => {
                        return (
                            <ProgramCard
                                program={program}
                                callMutate={() => void mutate()}
                                view={activeView}
                                key={program.id}
                            />
                        );
                    })
                )}
            </div>

            <dialog ref={addProgramModal} className="modal">
                <form method="dialog" className="modal-box">
                    <h3 className="font-bold text-lg">Add New Program</h3>
                    <p className="py-4">
                        This feature will be implemented soon.
                    </p>
                    <div className="modal-action">
                        <button className="btn">Close</button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}
