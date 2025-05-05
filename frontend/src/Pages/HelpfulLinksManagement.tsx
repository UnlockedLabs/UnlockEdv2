import {
    HelpfulLink,
    FilterLibrariesVidsandHelpfulLinksResident,
    ModalType,
    ServerResponseOne,
    ToastState,
    HelpfulLinkAndSort,
    UserRole,
    ViewType
} from '@/common';
import ToggleView from '@/Components/ToggleView';
import HelpfulLinkCard from '@/Components/cards/HelpfulLinkCard';
import SearchBar from '@/Components/inputs/SearchBar';
import Pagination from '@/Components/Pagination';
import React, { useRef, useState } from 'react';
import { useToast } from '@/Context/ToastCtx';
import { useDebounceValue } from 'usehooks-ts';
import useSWR from 'swr';
import API from '@/api/api';
import { useAuth } from '@/useAuth';
import DropdownControl from '@/Components/inputs/DropdownControl';
import {
    AddHelpfulLinkModal,
    closeModal,
    EditHelpfulLinkModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useSessionViewType } from '@/Hooks/sessionView';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import { AddButton } from '@/Components/inputs';

export default function HelpfulLinksManagement() {
    const { user } = useAuth();
    const addLinkModal = useRef<HTMLDialogElement>(null);
    const editLinkModal = useRef<HTMLDialogElement>(null);
    const deleteLinkModal = useRef<HTMLDialogElement>(null);
    const [currentLink, setCurrentLink] = useState<HelpfulLink | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const searchQuery = useDebounceValue(searchTerm, 500);
    const [activeView, setActiveView] = useSessionViewType(
        'helpfulLinkManagementView'
    );
    const [sortQuery, setSortQuery] = useState<string>(
        FilterLibrariesVidsandHelpfulLinksResident['Title (A to Z)']
    );
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);
    const { toaster } = useToast();
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseOne<HelpfulLinkAndSort>,
        Error
    >(
        `/api/helpful-links?search=${searchQuery[0]}&page=${pageQuery}&per_page=${perPage}${sortQuery}`
    );
    const checkResponseForDelete = useCheckResponse({
        mutate: mutate,
        refModal: deleteLinkModal
    });
    const helpfulLinks = data?.data.helpful_links ?? [];
    const meta = data?.data.meta;

    async function deleteLink() {
        const response = await API.delete(`helpful-links/${currentLink?.id}`);

        if (!response.success) {
            toaster('Error deleting helpful link', ToastState.error);
        }
        checkResponseForDelete(
            response.success,
            'Error deleting link',
            'Link successfully deleted'
        );
        closeDeleteLink();
    }

    function closeDeleteLink() {
        closeModal(deleteLinkModal);
        setCurrentLink(null);
    }

    function showModifyLink(
        link: HelpfulLink,
        type: ModalType,
        e: React.MouseEvent
    ) {
        e.stopPropagation();
        setCurrentLink(link);
        if (type === ModalType.Edit) {
            showModal(editLinkModal);
        } else if (type === ModalType.Delete) {
            showModal(deleteLinkModal);
        }
    }

    const handleChange = (newSearch: string) => {
        setSearchTerm(newSearch);
        setPageQuery(1);
    };

    return (
        <>
            <div className="flex flex-row justify-between items-center">
                <div className="flex flex-row gap-2 items-center">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleChange}
                    />
                    <DropdownControl
                        setState={setSortQuery}
                        enumType={FilterLibrariesVidsandHelpfulLinksResident}
                    />
                </div>
                <div className="flex flex-row items-center gap-4">
                    <ToggleView
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                    <AddButton
                        label="Add Link"
                        onClick={() => {
                            showModal(addLinkModal);
                        }}
                    />
                </div>
            </div>
            <div
                className={`mt-8 ${activeView === ViewType.Grid ? 'grid grid-cols-4 gap-6' : 'space-y-4'}`}
            >
                {/* map through the helpful links */}
                {helpfulLinks.map((link: HelpfulLink, index: number) => {
                    return (
                        <HelpfulLinkCard
                            key={index}
                            link={link}
                            mutate={() => void mutate()}
                            showModal={showModifyLink}
                            role={user ? user?.role : UserRole.Student}
                            view={activeView}
                        />
                    );
                })}
            </div>
            {/* Modals */}
            <AddHelpfulLinkModal mutate={mutate} ref={addLinkModal} />
            <EditHelpfulLinkModal
                mutate={mutate}
                targetLink={currentLink ?? ({} as HelpfulLink)}
                ref={editLinkModal}
            />
            <TextOnlyModal
                ref={deleteLinkModal}
                type={TextModalType.Delete}
                title={'Delete Link'}
                text={
                    'Are you sure you would like to delete this helpful link? This action cannot be undone.'
                }
                onSubmit={() => void deleteLink()}
                onClose={closeDeleteLink}
            />
            {!isLoading && !error && meta && (
                <div className="flex justify-center">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={setPerPage}
                    />
                </div>
            )}
        </>
    );
}
