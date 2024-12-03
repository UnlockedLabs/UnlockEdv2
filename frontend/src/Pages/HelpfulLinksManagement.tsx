<<<<<<< HEAD
import {
    HelpfulLink,
    ModalType,
    ServerResponseOne,
    ToastState,
    HelpfulLinkAndSort
} from '@/common';
||||||| parent of 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
import { HelpfulLink, ModalType } from '@/common';
=======
import {
    HelpfulLink,
    ModalType,
    ServerResponseMany,
    ToastState
} from '@/common';
>>>>>>> 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import AddLinkForm from '@/Components/forms/AddLinkForm';
import DeleteForm from '@/Components/DeleteForm';
import EditLinkForm from '@/Components/forms/EditLinkForm';
import Modal from '@/Components/Modal';
import SearchBar from '@/Components/inputs/SearchBar';
import Pagination from '@/Components/Pagination';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';
<<<<<<< HEAD
import { useToast } from '@/Context/ToastCtx';
import { useDebounceValue } from 'usehooks-ts';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import API from '@/api/api';
import SortByPills from '@/Components/pill-labels/SortByPills';
||||||| parent of 415ae1e (feat: add backend api calls for helpful-links and some frontend work)

const helpfulLinks: HelpfulLink[] = [
    {
        id: 1,
        name: 'Unlocked Labs Website Website ',
        url: 'www.unlockedlabs.org',
        description:
            'description of unlocked labs description of unlocked labs description of unlocked labs description of unlocked labs description of unlocked labs ',
        open_content_provider_id: 3,
        facility_id: 1,
        visibility_status: true
    },
    {
        id: 2,
        name: 'Unlocked Labs LinkedIn',
        url: 'https://www.linkedin.com/company/labs-unlocked/',
        description: 'description of unlocked labs',
        open_content_provider_id: 3,
        facility_id: 1,
        visibility_status: false
    }
];
=======
import { useToast } from '@/Context/ToastCtx';
import { useDebounceValue } from 'usehooks-ts';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import API from '@/api/api';
>>>>>>> 415ae1e (feat: add backend api calls for helpful-links and some frontend work)

export default function HelpfulLinksManagement() {
    const addLinkModal = useRef<HTMLDialogElement>(null);
    const editLinkModal = useRef<HTMLDialogElement>(null);
    const deleteLinkModal = useRef<HTMLDialogElement>(null);
    const [currentLink, setCurrentLink] = useState<HelpfulLink>();
<<<<<<< HEAD
    const [perPage, setPerPage] = useState<number>(10);
    const [pageQuery, setPageQuery] = useState<number>(1);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const searchQuery = useDebounceValue(searchTerm, 500);
    const { toaster } = useToast();
||||||| parent of 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
=======
    const [perPage, setPerPage] = useState<number>(10);
    const [pageQuery, setPageQuery] = useState<number>(1);
    const [sortQuery, setSortQuery] = useState('created_at DESC');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const searchQuery = useDebounceValue(searchTerm, 500);
    const { toaster } = useToast();
>>>>>>> 415ae1e (feat: add backend api calls for helpful-links and some frontend work)

<<<<<<< HEAD
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseOne<HelpfulLinkAndSort>,
        AxiosError
    >(
        `/api/helpful-links?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}`
    );
    const helpfulLinks = data?.data.helpful_links ?? [];
    const meta = data?.data.meta;
    let globalSortOrder = data?.data.sort_order;
||||||| parent of 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
    // grab the data
=======
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<HelpfulLink>,
        AxiosError
    >(
        `/api/helpful-links?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}&sort=${sortQuery}`
    );
    const helpfulLinks = data?.data ?? [];
    const meta = data?.meta;
>>>>>>> 415ae1e (feat: add backend api calls for helpful-links and some frontend work)

    function updateLinks() {
<<<<<<< HEAD
        addLinkModal.current?.close();
        editLinkModal.current?.close();
        void mutate();
    }
    async function deleteLink(id: number | undefined) {
        const response = await API.delete(`helpful-links/${id}`);
        if (response.success) {
            updateLinks();
        }
        toaster(
            response.message,
            response.success ? ToastState.success : ToastState.error
        );
        deleteLinkModal.current?.close();
||||||| parent of 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
        // api put request
        // close modal
=======
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
>>>>>>> 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
    }

    function showModifyLink(link: HelpfulLink, type: ModalType) {
        setCurrentLink(link);
        if (type === ModalType.Edit) {
            editLinkModal.current?.showModal();
        } else if (type === ModalType.Delete) {
            deleteLinkModal.current?.showModal();
        }
    }

<<<<<<< HEAD
    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        setPageQuery(1);
    };

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
        void mutate();
    };

    async function updateGlobalSort(sort: string) {
        const response = await API.put<
            { message: string },
            { sort_order: string }
        >('helpful-links/sort', { sort_order: sort });
        if (response.success) {
            globalSortOrder = sort;
            void mutate();
        }
        toaster(
            response.message,
            response.success ? ToastState.success : ToastState.error
        );
    }

    const sortPills = [
        { name: 'Date Added ↓', value: 'created_at DESC' },
        { name: 'Date Added ↑', value: 'created_at ASC' },
        { name: 'Title (A-Z)', value: 'title ASC' },
        { name: 'Title (Z-A)', value: 'title DESC' }
    ];

||||||| parent of 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
=======
    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        setPageQuery(1);
    };

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
        void mutate();
    };

>>>>>>> 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
    return (
        <>
            <div className="flex flex-row justify-between">
                {/* TO DO: make this a common enum? */}
<<<<<<< HEAD
                <div className="flex flex-row gap-2 items-center">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleChange}
                    />
                    <h3 className="ml-2">Order:</h3>
                    {sortPills.map((label) => (
                        <SortByPills
                            key={label.value + label.name}
                            label={label}
                            updateSort={updateGlobalSort}
                            isSelected={label.value === globalSortOrder}
                        />
                    ))}
                </div>
||||||| parent of 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
                <DropdownControl
                    enumType={{
                        'Date Added ↓': 'created_at DESC',
                        'Date Added ↑': 'created_at ASC',
                        'Title (A-Z)': 'title ASC',
                        'Title (Z-A)': 'title DESC'
                    }}
                />
=======
                <SearchBar
                    searchTerm={searchTerm}
                    changeCallback={handleChange}
                />
                <DropdownControl
                    label="Order by"
                    setState={setSortQuery}
                    enumType={{
                        'Date Added ↓': 'created_at DESC',
                        'Date Added ↑': 'created_at ASC',
                        'Title (A-Z)': 'title ASC',
                        'Title (Z-A)': 'title DESC'
                    }}
                />
>>>>>>> 415ae1e (feat: add backend api calls for helpful-links and some frontend work)
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
||||||| parent of 237bd97 (feat: add frontend helpful links)
=======
import { HelpfulLink, ModalType } from '@/common';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import AddLinkForm from '@/Components/forms/AddLinkForm';
import EditLinkForm from '@/Components/forms/EditLinkForm';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Modal from '@/Components/Modal';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';

const helpfulLinks: HelpfulLink[] = [
    {
        id: 1,
        name: 'Unlocked Labs Website Website ',
        url: 'www.unlockedlabs.org',
        description:
            'description of unlocked labs description of unlocked labs description of unlocked labs description of unlocked labs description of unlocked labs ',
        open_content_provider_id: 3,
        facility_id: 1,
        visibility_status: true
    },
    {
        id: 2,
        name: 'Unlocked Labs LinkedIn',
        url: 'https://www.linkedin.com/company/labs-unlocked/',
        description: 'description of unlocked labs',
        open_content_provider_id: 3,
        facility_id: 1,
        visibility_status: false
    }
];

export default function HelpfulLinksManagement() {
    const addLinkModal = useRef<HTMLDialogElement>(null);
    const editLinkModal = useRef<HTMLDialogElement>(null);
    const [currentLink, setCurrentLink] = useState<HelpfulLink>();

    // grab the data

    function updateLinks() {
        // api put request
        // close modal
    }

    function showEditLink(link: HelpfulLink) {
        setCurrentLink(link);
        editLinkModal.current?.showModal();
    }

    return (
        <div className="w-full flex flex-col gap-8">
            <div className="flex flex-row justify-between">
                {/* searcha nd sort */}
                {/* TO DO: make this a common enum? */}
                <DropdownControl
                    enumType={{
                        'Date Added ↓': 'created_at DESC',
                        'Date Added ↑': 'created_at ASC',
                        'Title (A-Z)': 'title ASC',
                        'Title (Z-A)': 'title DESC'
                    }}
                />
                {/* add links button */}
                <div
                    className="button my-auto"
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
                            showEditLink={showEditLink}
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
        </div>
    );
}
