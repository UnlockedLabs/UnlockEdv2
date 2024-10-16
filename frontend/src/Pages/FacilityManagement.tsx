// import Modal from '@/Components/Modal.tsx';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.tsx';
import {
    Facility,
    ModalType,
    // PaginationMeta,
    ServerResponse,
    ToastState
} from '@/common.ts';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import Toast from '@/Components/Toast.tsx';
import FacilityCard from '@/Components/FacilityCard.tsx';
import Modal from '@/Components/Modal.tsx';
// import AddProviderForm from '@/Components/forms/AddProviderForm.tsx';
import AddFacilityForm from '@/Components/forms/AddFacilityForm.tsx';
// import Pagination from '@/Components/Pagination.tsx';
// import SearchBar from '@/Components/inputs/SearchBar.tsx';

interface ToastProps {
    state: ToastState;
    message: string;
}

export default function FacilityManagement() {
    const addFacilityModal = useRef<undefined | HTMLDialogElement>();
    // const editFacilityModal = useRef<undefined | HTMLDialogElement>();
    // const [editFacility, setEditFacility] = useState<
    //     Facility | undefined
    // >();
    // const [setEditFacility] = useState<
    //     Facility | undefined
    // >();
    const [toast, setToast] = useState<ToastProps>({
        state: ToastState.null,
        message: ''
    });

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
            // setEditFacility(undefined);
        }, 200);
    }
    //
    // function openEditFacility(facility: Facility) {
    //     setEditFacility(facility);
    //     editFacilityModal.current?.showModal();
    // }

    function updateFacility(state: ToastState, message: string) {
        mutate();
        if (state && message) {
            setToast({
                state: state,
                message: message
            });
        }
        // editFacilityModal.current?.close();
        addFacilityModal.current?.close();
        resetModal();
    }

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
                        <tr className="grid-cols-4 px-4">
                            <th className="justify-self-start">Name</th>
                            <th>Timezone</th>
                            <th className="justify-self-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading && !error ? (
                            facilityData.map((facility: Facility) => {
                                return <FacilityCard facility={facility} />;
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
            {/*<Modal*/}
            {/*    type={ModalType.Edit}*/}
            {/*    item="Provider"*/}
            {/*    form={*/}
            {/*        editFacility ? (*/}
            {/*            <EditProviderForm*/}
            {/*                onSuccess={(state: ToastState, message: string) => {*/}
            {/*                    updateFacility(state, message);*/}
            {/*                }}*/}
            {/*                provider={editFacility}*/}
            {/*            />*/}
            {/*        ) : (*/}
            {/*            <div></div>*/}
            {/*        )*/}
            {/*    }*/}
            {/*    ref={editFacilityModal}*/}
            {/*/>*/}
            {/*<Modal*/}
            {/*    type={ModalType.Register}*/}
            {/*    item="Provider"*/}
            {/*    form={*/}
            {/*        editFacility ? (*/}
            {/*            <RegisterOidcClientForm*/}
            {/*                provider={editFacility}*/}
            {/*                onSuccess={onRegisterOidcClientClose}*/}
            {/*                onClose={() => openOidcClientModal.current?.close()}*/}
            {/*            />*/}
            {/*        ) : (*/}
            {/*            <div></div>*/}
            {/*        )*/}
            {/*    }*/}
            {/*    ref={openOidcClientModal}*/}
            {/*/>*/}
            {/*<Modal*/}
            {/*    type={ModalType.Register}*/}
            {/*    item="OIDC Client"*/}
            {/*    form={*/}
            {/*        oidcClient ? (*/}
            {/*            <NewOidcClientNotification*/}
            {/*                client={oidcClient}*/}
            {/*                onClose={() =>*/}
            {/*                    openOidcRegistrationModal.current?.close()*/}
            {/*                }*/}
            {/*            />*/}
            {/*        ) : (*/}
            {/*            <div></div>*/}
            {/*        )*/}
            {/*    }*/}
            {/*    ref={openOidcRegistrationModal}*/}
            {/*/>*/}
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
