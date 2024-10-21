import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.tsx';
import { Facility, ModalType, ServerResponse, ToastState } from '@/common.ts';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import Toast from '@/Components/Toast.tsx';
import FacilityCard from '@/Components/FacilityCard.tsx';
import DeleteForm from '../Components/DeleteForm';
import Modal from '@/Components/Modal.tsx';
import AddFacilityForm from '@/Components/forms/AddFacilityForm.tsx';
import EditFacilityForm from '@/Components/forms/EditFacilityForm';
import API from '@/api/api';
// import Pagination from '@/Components/Pagination.tsx';
// import SearchBar from '@/Components/inputs/SearchBar.tsx';

interface ToastProps {
    state: ToastState;
    message: string;
}

export default function FacilityManagement() {
    const addFacilityModal = useRef<undefined | HTMLDialogElement>();
    const editFacilityModal = useRef<undefined | HTMLDialogElement>();
    const deleteFacilityModal = useRef<undefined | HTMLDialogElement>();
    const [editFacility, setEditFacility] = useState<Facility | undefined>();
    const [toast, setToast] = useState<ToastProps>({
        state: ToastState.null,
        message: ''
    });
    const [targetFacility, setTargetFacility] = useState<
        undefined | Facility
    >();
    // TODO: modify this const
    const {
        data: facility,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponse<Facility>>(`/api/facilities`);

    const facilityData = facility?.data ? (facility.data as Facility[]) : [];
    // const meta = facility?.meta as PaginationMeta;
    // // const [searchTerm, setSearchTerm] = useState('');
    // // const searchQuery = useDebounceValue(searchTerm, 300);
    // const [, setPageQuery] = useState(1);
    // const [sortQuery, setSortQuery] = useState('created_at DESC');

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
        mutate();
        if (state && message) {
            setToast({
                state: state,
                message: message
            });
        }
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
        const response = await API.delete('facilities/' + targetFacility?.id);
        if (response.success) {
            setToast({
                state: ToastState.success,
                message: 'Facility successfully deleted.'
            });
        } else {
            setToast({
                state: ToastState.error,
                message: 'Error deleting Facility.'
            });
        }
        deleteFacilityModal.current?.close();
        resetModal();
        mutate();
        return;
    };

    // const handleChange = (newSearch: string) => {
    //     setSearchTerm(newSearch);
    //     setPageQuery(1);
    // };

    return (
        <AuthenticatedLayout
            title="Facility Management"
            path={['Facility Management']}
        >
            <div className="px-8 py-4">
                <h1>Facility Management</h1>
                <div className="flex flex-row justify-between">
                    <div>
                        {/* TO DO: this is where SEARCH and SORT will go */}
                        <div className="flex flex-row gap-x-2">
                            {/*<SearchBar*/}
                            {/*    searchTerm={searchTerm}*/}
                            {/*    changeCallback={handleChange}*/}
                            {/*/>*/}
                            {/*<DropdownControl*/}
                            {/*    label="order by"*/}
                            {/*    callback={setSortQuery}*/}
                            {/*    enumType={{*/}
                            {/*        'Name (A-Z)': 'name_last asc',*/}
                            {/*        'Name (Z-A)': 'name_last desc',*/}
                            {/*        'Account Created ↓ ': 'created_at desc',*/}
                            {/*        'Account Created ↑ ': 'created_at asc'*/}
                            {/*    }}*/}
                            {/*/>*/}
                        </div>
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
                {/*{!isLoading && !error && facilityData.length > 0 && (*/}
                {/*    <Pagination meta={meta} setPage={setPageQuery} />*/}
                {/*)}*/}
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
                        onSuccess={handleDeleteFacility}
                    />
                }
            />
            {/* Toasts */}
            {toast.state !== ToastState.null && (
                <Toast
                    state={toast.state}
                    message={toast.message}
                    reset={() =>
                        setToast({ state: ToastState.null, message: '' })
                    }
                />
            )}
        </AuthenticatedLayout>
    );
}
