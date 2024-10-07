import ProviderCard from '@/Components/ProviderCard';
import AddProviderForm from '@/Components/forms/AddProviderForm';
import EditProviderForm from '@/Components/forms/EditProviderForm';
import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    ModalType,
    OidcClient,
    ProviderPlatform,
    ServerResponse,
    ToastProps,
    ToastState
} from '@/common';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import Toast from '@/Components/Toast';
import RegisterOidcClientForm from '@/Components/forms/RegisterOidcClientForm';
import NewOidcClientNotification from '@/Components/NewOidcClientNotification';
import API from '@/api/api';

export default function ProviderPlatformManagement() {
    const addProviderModal = useRef<undefined | HTMLDialogElement>();
    const editProviderModal = useRef<undefined | HTMLDialogElement>();
    const [editProvider, setEditProvider] = useState<
        ProviderPlatform | undefined
    >();
    const openOidcClientModal = useRef<undefined | HTMLDialogElement>();
    const openOidcRegistrationModal = useRef<undefined | HTMLDialogElement>();
    const [oidcClient, setOidcClient] = useState<OidcClient | undefined>();
    const [toast, setToast] = useState<ToastProps>({
        state: ToastState.null,
        message: ''
    });

    const {
        data: providers,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponse<ProviderPlatform>>(`/api/provider-platforms`);
    const providerData = providers?.data
        ? (providers.data as ProviderPlatform[])
        : [];

    function resetModal() {
        setTimeout(() => {
            setEditProvider(undefined);
        }, 200);
    }

    function openEditProvider(provider: ProviderPlatform) {
        setEditProvider(provider);
        editProviderModal.current?.showModal();
    }

    function updateProvider(state: ToastState, message: string) {
        mutate();
        if (state && message) {
            setToast({
                state: state,
                message: message
            });
        }
        editProviderModal.current?.close();
        addProviderModal.current?.close();
        resetModal();
    }

    const registerOidcClient = (prov: ProviderPlatform) => {
        openOidcClientModal.current?.showModal();
        setEditProvider(prov);
    };

    const onRegisterOidcClientClose = (
        response: ServerResponse<OidcClient>,
        state: ToastState
    ) => {
        openOidcClientModal.current?.close();
        setEditProvider(undefined);
        if (!response && state === ToastState.success) {
            setToast({
                state: state,
                message: 'OIDC client registered successfully.'
            });
        } else if (!response && state === ToastState.error) {
            setToast({
                state: state,
                message: 'Failed to register OIDC client.'
            });
        } else {
            setOidcClient(response.data as OidcClient);
            openOidcRegistrationModal.current?.showModal();
        }
        mutate();
        state &&
            response &&
            setToast({
                state: state,
                message: response.message
            });
    };
    const handleToggleArchiveProvider = (provider: ProviderPlatform) => {
        const state = provider.state === 'archived' ? 'enabled' : 'archived';
        API.patch(`provider-platforms/${provider.id}`, {
            state: state
        }).then((resp) => {
            resp.success &&
                setToast({
                    state: ToastState.success,
                    message: `Provider platform ${provider.name} has been ${state}.`
                });
            mutate();
        });
    };

    const showAuthorizationInfo = async (provider: ProviderPlatform) => {
        const resp = await API.get<OidcClient>(
            `oidc/clients/${provider.oidc_id}`
        );
        if (resp.success) {
            setOidcClient(resp.data as OidcClient);
            openOidcRegistrationModal.current?.showModal();
            return;
        }
    };

    return (
        <AuthenticatedLayout
            title="Provider Platform Management"
            path={['Provider Platform Management']}
        >
            <div className="px-8 py-4">
                <h1>Provider Platforms</h1>
                <div className="flex flex-row justify-between">
                    <div>
                        {/* TO DO: this is where SEARCH and SORT will go */}
                    </div>
                    <button
                        className="button"
                        onClick={() => {
                            addProviderModal.current?.showModal();
                        }}
                    >
                        <PlusCircleIcon className="w-4 my-auto" />
                        Add Provider
                    </button>
                </div>
                <table className="table-2">
                    <thead>
                        <tr className="grid-cols-4 px-4">
                            <th className="justify-self-start">Name</th>
                            <th>Registered</th>
                            <th>Status</th>
                            <th className="justify-self-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!isLoading && !error ? (
                            providerData.map((provider: ProviderPlatform) => {
                                return (
                                    <ProviderCard
                                        key={provider.id}
                                        provider={provider}
                                        openEditProvider={openEditProvider}
                                        oidcClient={() =>
                                            registerOidcClient(provider)
                                        }
                                        showAuthorizationInfo={() =>
                                            showAuthorizationInfo(provider)
                                        }
                                        archiveProvider={() =>
                                            handleToggleArchiveProvider(
                                                provider
                                            )
                                        }
                                    />
                                );
                            })
                        ) : (
                            <tr>
                                <td>No provider platforms</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Modals */}
            <Modal
                type={ModalType.Add}
                item="Provider"
                form={
                    <AddProviderForm
                        onSuccess={(state: ToastState, message: string) => {
                            updateProvider(state, message);
                        }}
                    />
                }
                ref={addProviderModal}
            />
            <Modal
                type={ModalType.Edit}
                item="Provider"
                form={
                    editProvider ? (
                        <EditProviderForm
                            onSuccess={(state: ToastState, message: string) => {
                                updateProvider(state, message);
                            }}
                            provider={editProvider}
                        />
                    ) : (
                        <div></div>
                    )
                }
                ref={editProviderModal}
            />
            <Modal
                type={ModalType.Register}
                item="Provider"
                form={
                    editProvider ? (
                        <RegisterOidcClientForm
                            provider={editProvider}
                            onSuccess={onRegisterOidcClientClose}
                            onClose={() => openOidcClientModal.current?.close()}
                        />
                    ) : (
                        <div></div>
                    )
                }
                ref={openOidcClientModal}
            />
            <Modal
                type={ModalType.Register}
                item="OIDC Client"
                form={
                    oidcClient ? (
                        <NewOidcClientNotification
                            client={oidcClient}
                            onClose={() =>
                                openOidcRegistrationModal.current?.close()
                            }
                        />
                    ) : (
                        <div></div>
                    )
                }
                ref={openOidcRegistrationModal}
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
