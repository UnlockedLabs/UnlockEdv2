import { isAdministrator, useAuth } from '@/useAuth';
import { useState } from 'react';
import ProgramCard from '@/Components/ProgramCard';
import SearchBar from '@/Components/inputs/SearchBar';
import { Program, ViewType, Option, ServerResponseMany } from '@/common';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import ToggleView from '@/Components/ToggleView';
import { useLoaderData } from 'react-router-dom';
import Pagination from '@/Components/Pagination';
import { useNavigate } from 'react-router-dom';
import CategoryDropdownFilter from '@/Components/CategoryDropdownFilter';
import { useSessionViewType } from '@/Hooks/sessionView';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';

export enum sortPrograms {}

export default function ProgramManagement() {
    const { user } = useAuth();
    const [activeView, setActiveView] = useSessionViewType('programView');
    const [searchTerm, setSearchTerm] = useState('');
    const {
        page: page,
        perPage,
        setPage: setPage,
        setPerPage
    } = useUrlPagination(1, 20);

    const [categoryQueryString, setCategoryQueryString] = useState<string>('');
    const navigate = useNavigate();
    const { data, error, mutate } = useSWR<
        ServerResponseMany<Program>,
        AxiosError
    >(
        `/api/programs?page=${page}&per_page=${perPage}&search=${searchTerm}&${categoryQueryString}&order=asc&order_by=name`
    );
    const programData = data?.data;
    const meta = data?.meta;

    const { categories } = useLoaderData() as {
        categories: Option[];
    };

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
                    <CategoryDropdownFilter
                        mutate={() => void mutate()}
                        setCategoryQueryString={setCategoryQueryString}
                        options={categories ?? []}
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
                                navigate('detail');
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
        </div>
    );
}
