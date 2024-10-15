// import ProviderCard from '@/Components/ProviderCard.tsx';
import AddProviderForm from '@/Components/forms/AddProviderForm.tsx';
// import EditProviderForm from '@/Components/forms/EditProviderForm.tsx';
import Modal from '@/Components/Modal.tsx';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.tsx';
import {
    Facility,
    ModalType,
    // OidcClient,
    ServerResponse,
    ToastState
} from '@/common.ts';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import Toast from '@/Components/Toast.tsx';
import FacilityCard from '@/Components/FacilityCard.tsx';
// import RegisterOidcClientForm from '@/Components/forms/RegisterOidcClientForm.tsx';
// import NewOidcClientNotification from '@/Components/NewOidcClientNotification.tsx';

interface ToastProps {
    state: ToastState;
    message: string;
}

export default function FacilityManagement() {
    const addFacilityModal = useRef<undefined | HTMLDialogElement>();
    const editFacilityModal = useRef<undefined | HTMLDialogElement>();
    // const [editFacility, setEditFacility] = useState<Facility | undefined>();
    // const openOidcClientModal = useRef<undefined | HTMLDialogElement>();
    // const openOidcRegistrationModal = useRef<undefined | HTMLDialogElement>();
    // const [oidcClient, setOidcClient] = useState<OidcClient | undefined>();
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
    // const [pageQuery, setPageQuery] = useState(1);
    // function resetModal() {
    //     setTimeout(() => {
    //         setEditFacility(undefined);
    //     }, 200);
    // }
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
        editFacilityModal.current?.close();
        addFacilityModal.current?.close();
        // resetModal();
    }

    // const registerOidcClient = (fac: Facility) => {
    //     openOidcClientModal.current?.showModal();
    //     setEditFacility(fac);
    // };
    //
    // const onRegisterOidcClientClose = (
    //     response: ServerResponse<OidcClient>,
    //     state: ToastState
    // ) => {
    //     openOidcClientModal.current?.close();
    //     setEditFacility(undefined);
    //     if (!response && state === ToastState.success) {
    //         setToast({
    //             state: state,
    //             message: 'OIDC client registered successfully.'
    //         });
    //     } else if (!response && state === ToastState.error) {
    //         setToast({
    //             state: state,
    //             message: 'Failed to register OIDC client.'
    //         });
    //     } else {
    //         setOidcClient(response.data as OidcClient);
    //         openOidcRegistrationModal.current?.showModal();
    //     }
    //     mutate();
    //     state &&
    //         response &&
    //         setToast({
    //             state: state,
    //             message: response.message
    //         });
    // };
    // const handleToggleArchiveProvider = (provider: ProviderPlatform) => {
    //     const state = provider.state === 'archived' ? 'enabled' : 'archived';
    //     API.patch(`provider-platforms/${provider.id}`, {
    //         state: state
    //     }).then((resp) => {
    //         resp.success &&
    //             setToast({
    //                 state: ToastState.success,
    //                 message: `Provider platform ${provider.name} has been ${state}.`
    //             });
    //         mutate();
    //     });
    // };

    // const showAuthorizationInfo = async (provider: ProviderPlatform) => {
    //     const resp = await API.get<OidcClient>(
    //         `oidc/clients/${provider.oidc_id}`
    //     );
    //     if (resp.success) {
    //         setOidcClient(resp.data as OidcClient);
    //         openOidcRegistrationModal.current?.showModal();
    //         return;
    //     }
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
                    <AddProviderForm
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
