import { isAdministrator, useAuth } from '@/useAuth';
import { useState, useRef } from 'react';
import ProgramCard from '@/Components/ProgramCard';
import SearchBar from '@/Components/inputs/SearchBar';
import { Program, ServerResponseMany, ViewType, Facility } from '@/common';
import useSWR from 'swr';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { AxiosError } from 'axios';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import ToggleView from '@/Components/ToggleView';
import Modal from '@/Components/Modal';
import CreateProgramForm from '@/Components/forms/CreateProgramForm';
import { useLoaderData } from 'react-router-dom';
import Pagination from '@/Components/Pagination';
import { showModal } from '@/Components/modals';

export default function Programs() {
    const { user } = useAuth();
    const addProgramModal = useRef<HTMLDialogElement>(null);
    const facilities = useLoaderData() as Facility[];
    if (!user) {
        return null;
    }
    const [activeView, setActiveView] = useState<ViewType>(ViewType.Grid);
    const [searchTerm, setSearchTerm] = useState('');
    const [order, setOrder] = useState('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const { data, error, mutate } = useSWR<
        ServerResponseMany<Program>,
        AxiosError
    >(
        `/api/programs?search=${searchTerm}&order=${order}&page=${page}&per_page=${perPage}`
    );
    const programData = data?.data;
    const meta = data?.meta;

    function handleSearch(newSearch: string) {
        setSearchTerm(newSearch);
        setPage(1);
    }

    return (
        <div className="px-5 py-4">
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
                    {isAdministrator(user) && (
                        <button
                            className="button flex items-center space-x-2"
                            onClick={() => {
                                showModal(addProgramModal);
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
            {meta && (
                <div className="flex justify-center mt-4">
                    <Pagination
                        meta={meta}
                        setPage={setPage}
                        setPerPage={setPerPage}
                    />
                </div>
            )}
            <Modal
                ref={addProgramModal}
                type="Add"
                item="Program"
                form={
                    <CreateProgramForm
                        onSuccess={() => void mutate()}
                        facilities={facilities}
                    />
                }
            />
        </div>
    );
}
