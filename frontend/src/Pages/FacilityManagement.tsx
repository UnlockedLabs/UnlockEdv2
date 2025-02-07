import {
    Facility,
    ModalType,
    ServerResponseMany,
    ToastState
} from '@/common.ts';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import FacilityCard from '@/Components/FacilityCard.tsx';
import DeleteForm from '../Components/DeleteForm';
import Modal from '@/Components/Modal.tsx';
import API from '@/api/api';
import Pagination from '@/Components/Pagination.tsx';
import { AxiosError } from 'axios';
import { useToast } from '@/Context/ToastCtx';
import {
    AddFacilityModal,
    CRUDActions,
    EditFacilityModal
} from '@/Components/modals';

export default function FacilityManagement() {
    const addFacilityModal = useRef<HTMLDialogElement>(null);
    const editFacilityModal = useRef<HTMLDialogElement>(null);
    const deleteFacilityModal = useRef<HTMLDialogElement>(null);
    const { toaster } = useToast();
    const [targetFacility, setTargetFacility] = useState<{
        action: CRUDActions;
        facility: Facility;
    } | null>(null);

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

    const facilityData = facility?.data ?? [];

    useEffect(() => {
        if (targetFacility?.action == CRUDActions.Edit) {
            editFacilityModal.current?.showModal();
        }
        if (targetFacility?.action == CRUDActions.Add) {
            addFacilityModal.current?.showModal();
        }
        if (targetFacility?.action == CRUDActions.Delete) {
            deleteFacilityModal.current?.showModal();
        }
    }, [targetFacility]);

    const openDeleteFacility = (facility: Facility) => {
        setTargetFacility({
            action: CRUDActions.Delete,
            facility: facility
        });
    };

    function openEditFacility(facility: Facility) {
        setTargetFacility({
            action: CRUDActions.Edit,
            facility: facility
        });
    }

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
        void mutate();
    };

    const deleteFacility = async () => {
        if (targetFacility?.facility.id == 1) {
            toaster('Cannot delete default facility', ToastState.error);
            deleteFacilityModal.current?.close();
            return;
        }
        const response = await API.delete(
            'facilities/' + targetFacility?.facility.id
        );
        if (response.success) {
            toaster('Facility successfully deleted', ToastState.success);
            void mutate();
        } else {
            toaster('Error deleting facility', ToastState.error);
        }
        deleteFacilityModal.current?.close();
        setTargetFacility(null);
        return;
    };
    return (
        <>
            <div className="px-5 py-4 flex flex-col justify-center gap-4">
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
            <AddFacilityModal mutate={mutate} ref={addFacilityModal} />
            <EditFacilityModal
                mutate={mutate}
                ref={editFacilityModal}
                target={targetFacility?.facility}
            />
            <Modal
                ref={deleteFacilityModal}
                type={ModalType.Confirm}
                item="Delete Facility"
                form={
                    <DeleteForm
                        item="Facility"
                        onCancel={() => deleteFacilityModal.current?.close()}
                        onSuccess={() => void deleteFacility}
                    />
                }
            />
        </>
    );
}
