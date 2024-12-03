import {
    HelpfulLink,
    ModalType,
    ServerResponseMany,
    ToastState
} from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import AddLinkForm from '@/Components/forms/AddLinkForm';
import DeleteForm from '@/Components/DeleteForm';
import EditLinkForm from '@/Components/forms/EditLinkForm';
import Modal from '@/Components/Modal';
import SearchBar from '@/Components/inputs/SearchBar';
import Pagination from '@/Components/Pagination';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';
import { useToast } from '@/Context/ToastCtx';
import { useDebounceValue } from 'usehooks-ts';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import API from '@/api/api';
import SortByPills from '@/Components/pill-labels/SortByPills';

export default function HelpfulLinksManagement() {
    const addLinkModal = useRef<HTMLDialogElement>(null);
    const editLinkModal = useRef<HTMLDialogElement>(null);
    const deleteLinkModal = useRef<HTMLDialogElement>(null);
    const [currentLink, setCurrentLink] = useState<HelpfulLink>();
    const [perPage, setPerPage] = useState<number>(10);
    const [pageQuery, setPageQuery] = useState<number>(1);
    const [sortQuery, setSortQuery] = useState('created_at DESC');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const searchQuery = useDebounceValue(searchTerm, 500);
    const { toaster } = useToast();

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<HelpfulLink>,
        AxiosError
    >(
        `/api/helpful-links?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}&sort=${sortQuery}`
    );
    const helpfulLinks = data?.data ?? [];
    const meta = data?.meta;

    function updateLinks() {
        void mutate();
    }
    async function deleteLink(id: number | undefined) {
        const response = await API.delete(`/helpful-links/${id}`);
        if (response.success) {
            toaster(response.message, ToastState.success);
            updateLinks();
        } else {
            toaster(response.message, ToastState.error);
        }
    }

    function showModifyLink(link: HelpfulLink, type: ModalType) {
        setCurrentLink(link);
        if (type === ModalType.Edit) {
            editLinkModal.current?.showModal();
        } else if (type === ModalType.Delete) {
            deleteLinkModal.current?.showModal();
        }
    }

    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        setPageQuery(1);
    };

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
        void mutate();
    };

    return (
        <>
            <div className="flex flex-row justify-between">
                {/* TO DO: make this a common enum? */}
                <div className="flex flex-row gap-2 items-center">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleChange}
                    />
                    <h3 className="ml-2">Order:</h3>
                    <SortByPills
                        selected={false}
                        label={{
                            name: 'Date Added ↓',
                            value: 'created_at DESC'
                        }}
                        updateSort={setSortQuery}
                    />
                    <SortByPills
                        selected={false}
                        label={{
                            name: 'Date Added ↑',
                            value: 'created_at ASC'
                        }}
                        updateSort={setSortQuery}
                    />
                    <SortByPills
                        selected={true}
                        label={{
                            name: 'Title (A-Z)',
                            value: 'title ASC'
                        }}
                        updateSort={setSortQuery}
                    />
                    <SortByPills
                        selected={false}
                        label={{
                            name: 'Title (Z-A)',
                            value: 'title DESC'
                        }}
                        updateSort={setSortQuery}
                    />
                    {/* <DropdownControl
                        label="Order by"
                        setState={setSortQuery}
                        enumType={{
                            'Date Added ↓': 'created_at DESC',
                            'Date Added ↑': 'created_at ASC',
                            'Title (A-Z)': 'title ASC',
                            'Title (Z-A)': 'title DESC'
                        }}
                    /> */}
                </div>
                {/* add links button */}
                <div
                    className="button cursor-pointer items-center"
                    onClick={() => {
                        addLinkModal.current?.showModal();
                    }}
                >
                    <PlusCircleIcon className="w-4 my-auto" />
                    Add Link
                </div>
            </div>
            <div className="grid grid-cols-4 gap-6">
                {/* map through the helpful links */}
                {helpfulLinks.map((link: HelpfulLink, index: number) => {
                    return (
                        <HelpfulLinkCard
                            key={index}
                            link={link}
                            showModal={showModifyLink}
                        />
                    );
                })}
            </div>
            {/* Modals */}
            <Modal
                ref={addLinkModal}
                type={ModalType.Add}
                item={'Helpful Link'}
                form={<AddLinkForm onSuccess={updateLinks} />}
            />
            <Modal
                ref={editLinkModal}
                type={ModalType.Edit}
                item={'Helpful Link'}
                form={
                    currentLink ? (
                        <EditLinkForm
                            link={currentLink}
                            onSuccess={updateLinks}
                        />
                    ) : (
                        <div>No link selected!</div>
                    )
                }
            />
            <Modal
                ref={deleteLinkModal}
                type={ModalType.Delete}
                item={'Helpful Link'}
                form={
                    <DeleteForm
                        item={'Helpful Link'}
                        onCancel={() => {
                            setCurrentLink(undefined);
                        }}
                        onSuccess={() => {
                            void deleteLink(currentLink?.id);
                            void updateLinks;
                        }}
                    />
                }
            />

            {!isLoading && !error && meta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={handleSetPerPage}
                    />
                </div>
            )}
        </>
    );
}
