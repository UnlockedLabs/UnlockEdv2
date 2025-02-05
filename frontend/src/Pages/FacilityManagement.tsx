import { Facility, ServerResponseMany, ToastState } from '@/common.ts';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import FacilityCard from '@/Components/FacilityCard.tsx';
import API from '@/api/api';
import Pagination from '@/Components/Pagination.tsx';
import { AxiosError } from 'axios';
import { useToast } from '@/Context/ToastCtx';
import {
    AddFacilityModal,
    closeModal,
    CRUDActions,
    EditFacilityModal,
    showModal,
    TargetItem,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export default function FacilityManagement() {
    const addFacilityModal = useRef<HTMLDialogElement>(null);
    const editFacilityModal = useRef<HTMLDialogElement>(null);
    const deleteFacilityModal = useRef<HTMLDialogElement>(null);
    const { toaster } = useToast();
    const [targetFacility, setTargetFacility] =
        useState<TargetItem<Facility> | null>(null);

    const [perPage, setPerPage] = useState(10);
    const [pageQuery, setPageQuery] = useState(1);

    const {
        data: facility,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponseMany<Facility>, AxiosError>(
        `/api/facilities?page=${pageQuery}&per_page=${perPage}`
    );
    const checkResponseForDelete = useCheckResponse({
        mutate: mutate,
        refModal: deleteFacilityModal
    });

    const facilityData = facility?.data ?? [];

    useEffect(() => {
        const ref =
            targetFacility?.action === CRUDActions.Add
                ? addFacilityModal
                : targetFacility?.action === CRUDActions.Edit
                  ? editFacilityModal
                  : targetFacility?.action === CRUDActions.Delete
                    ? deleteFacilityModal
                    : null;
        if (ref) {
            showModal(ref);
        }
    }, [targetFacility]);

    const handleSetPerPage = (val: number) => {
        setPerPage(val);
        setPageQuery(1);
        void mutate();
    };

    const deleteFacility = async () => {
        if (targetFacility?.target.id == 1) {
            toaster('Cannot delete default facility', ToastState.error);
            closeModal(deleteFacilityModal);
            return;
        }
        const response = await API.delete(
            'facilities/' + targetFacility?.target.id
        );
        checkResponseForDelete(
            response.success,
            'Error deleting facility',
            'Facility successfully deleted'
        );
        closeDeleteFacility();
    };

    function closeDeleteFacility() {
        closeModal(deleteFacilityModal);
        setTargetFacility(null);
    }

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
                            showModal(addFacilityModal);
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
                                            setTargetFacility({
                                                action: CRUDActions.Edit,
                                                target: facility
                                            });
                                        }}
                                        openDeleteFacility={() => {
                                            setTargetFacility({
                                                action: CRUDActions.Delete,
                                                target: facility
                                            });
                                        }}
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
                target={targetFacility?.target}
            />
            <TextOnlyModal
                ref={deleteFacilityModal}
                type={TextModalType.Delete}
                title={'Delete Facility'}
                text={
                    'Are you sure you would like to delete this facility? This action cannot be undone.'
                }
                onSubmit={() => void deleteFacility()}
                onClose={closeDeleteFacility}
            />
        </>
    );
}
