import {
    Facility,
    ModalType,
    ServerResponseMany,
    ToastState
} from '@/common.ts';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import FacilityCard from '@/Components/FacilityCard.tsx';
import DeleteForm from '../Components/DeleteForm';
import Modal from '@/Components/Modal.tsx';
import AddFacilityForm from '@/Components/forms/AddFacilityForm.tsx';
import EditFacilityForm from '@/Components/forms/EditFacilityForm';
import API from '@/api/api';
import Pagination from '@/Components/Pagination.tsx';
import { AxiosError } from 'axios';
import { useToast } from '@/Context/ToastCtx';
import { useRevalidator } from 'react-router-dom';

export default function FacilityManagement() {
    const addFacilityModal = useRef<HTMLDialogElement>(null);
    const editFacilityModal = useRef<HTMLDialogElement>(null);
    const deleteFacilityModal = useRef<HTMLDialogElement>(null);
    const [editFacility, setEditFacility] = useState<Facility | undefined>();
    const { toaster } = useToast();
    const [targetFacility, setTargetFacility] = useState<
        undefined | Facility
    >();

    const [perPage, setPerPage] = useState(10);
    const [pageQuery, setPageQuery] = useState(1);

    // TODO: modify this const
    const {
        data: facility,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponseMany<Facility>, AxiosError>(
        `/api/facilities?page=${pageQuery}&per_page=${perPage}`
    );
    const { revalidate } = useRevalidator();

    const facilityData = facility?.data ?? [];

    function resetModal() {
        setTimeout(() => {
            setEditFacility(undefined);
        }, 200);
    }

    function openEditFacility(facility: Facility) {
        setEditFacility(facility);
        editFacilityModal.current?.showModal();
    }

    function updateFacility(state: ToastState, message: string) {
        void mutate();
        if (state && message) {
            toaster(message, state);
        }
        revalidate();
        editFacilityModal.current?.close();
        addFacilityModal.current?.close();
        resetModal();
    }

    const handleDeleteFacilityCancel = () => {
        deleteFacilityModal.current?.close();
        resetModal();
    };
    const openDeleteFacility = (facility: Facility) => {
        deleteFacilityModal.current?.showModal();
        setTargetFacility(facility);
    };
    const handleDeleteFacility = async () => {
        if (targetFacility?.id == 1) {
            toaster('Cannot delete default facility', ToastState.error);
            return;
        }

        await API.delete('facilities/' + targetFacility?.id)
            .then((response) => {
                if (response.success) {
                    toaster(
                        'Facility successfully deleted',
                        ToastState.success
                    );
                    revalidate();
                } else {
                    toaster('Error deleting facility', ToastState.success);
                }
            })
            .catch(() => {
                toaster('Error deleting facility', ToastState.error);
            });

        deleteFacilityModal.current?.close();
        resetModal();
        void mutate();
        return;
    };

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
        void mutate();
    };
    return (
        <>
            <div className="px-8 py-4 flex flex-col justify-center gap-4">
                <div className="flex flex-row justify-between">
                    <div>
                        {/* TO DO: this is where SEARCH and SORT will go */}
                        <div className="flex flex-row gap-x-2"></div>
                    </div>
                    <button
                        className="button"
                        onClick={() => {
                            addFacilityModal.current?.showModal();
                        }}
                    >
                        <PlusCircleIcon className="w-4 my-auto" />
                        Add Facility
                    </button>
                </div>
                <table className="table-2">
                    <thead>
                        <tr className="grid-cols-3 px-3">
                            <th className="justify-self-start">Name</th>
                            <th>Timezone</th>
                            <th className="justify-self-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading && !error ? (
                            facilityData.map((facility: Facility) => {
                                return (
                                    <FacilityCard
                                        key={facility.id}
                                        facility={facility}
                                        openEditFacility={() => {
                                            openEditFacility(facility);
                                        }}
                                        openDeleteFacility={openDeleteFacility}
                                    />
                                );
                            })
                        ) : (
                            <tr>
                                <td>No facilities</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {!isLoading &&
                    !error &&
                    facilityData.length > 0 &&
                    facility?.meta && (
                        <Pagination
                            meta={facility?.meta}
                            setPage={setPageQuery}
                            setPerPage={handleSetPerPage}
                        />
                    )}
            </div>
            {/* Modals */}
            <Modal
                type={ModalType.Add}
                item="Facility"
                form={
                    <AddFacilityForm
                        onSuccess={(state: ToastState, message: string) => {
                            updateFacility(state, message);
                        }}
                    />
                }
                ref={addFacilityModal}
            />
            <Modal
                type={ModalType.Edit}
                item="Facility"
                form={
                    editFacility ? (
                        <EditFacilityForm
                            onSuccess={(state: ToastState, message: string) => {
                                updateFacility(state, message);
                            }}
                            facility={editFacility}
                        />
                    ) : (
                        <div></div>
                    )
                }
                ref={editFacilityModal}
            />
            <Modal
                ref={deleteFacilityModal}
                type={ModalType.Confirm}
                item="Delete Facility"
                form={
                    <DeleteForm
                        item="Facility"
                        onCancel={handleDeleteFacilityCancel}
                        onSuccess={() => void handleDeleteFacility()}
                    />
                }
            />
        </>
    );
}
