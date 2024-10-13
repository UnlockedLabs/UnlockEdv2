import ProviderCard from '@/Components/ProviderCard';
import AddProviderForm from '@/Components/forms/AddProviderForm';
import EditProviderForm from '@/Components/forms/EditProviderForm';
import { AxiosError } from 'axios';
import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    ModalType,
    OidcClient,
    ProviderPlatform,
    ServerResponse,
    ToastProps,
    ToastState,
    ProviderPlatformState
} from '@/common';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import Toast from '@/Components/Toast';
import RegisterOidcClientForm from '@/Components/forms/RegisterOidcClientForm';
import NewOidcClientNotification from '@/Components/NewOidcClientNotification';
import API from '@/api/api';

export default function ProviderPlatformManagement() {
    const addProviderModal = useRef<HTMLDialogElement>(null);
    const editProviderModal = useRef<HTMLDialogElement>(null);
    const [editProvider, setEditProvider] = useState<
        ProviderPlatform | undefined
    >();
    const openOidcClientModal = useRef<HTMLDialogElement>(null);
    const openOidcRegistrationModal = useRef<HTMLDialogElement>(null);
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
    } = useSWR<ServerResponse<ProviderPlatform>, AxiosError>(
        `/api/provider-platforms`
    );
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
        void mutate();
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
        void mutate();
        if (response && state) {
            setToast({
                state: state,
                message: response.message
            });
        }
    };
    const handleToggleArchiveProvider = (provider: ProviderPlatform) => {
        const state =
            provider.state === ProviderPlatformState.ARCHIVED
                ? 'enabled'
                : 'archived';
        API.patch(`provider-platforms/${provider.id}`, {
            state: state
        })
            .then((resp) => {
                if (resp.success) {
                    setToast({
                        state: ToastState.success,
                        message: `Provider platform ${provider.name} has been ${state}.`
                    });
                    void mutate();
                }
            })
            .catch(() => {
                setToast({
                    state: ToastState.error,
                    message: 'Unable to toggle provider state'
                });
            });
    };

    const showAuthorizationInfo = (provider: ProviderPlatform) => {
        API.get<OidcClient>(`oidc/clients/${provider.oidc_id}`)
            .then((resp) => {
                if (resp.success) {
                    setOidcClient(resp.data as OidcClient);
                    openOidcRegistrationModal.current?.showModal();
                }
            })
            .catch(() => {
                setToast({
                    state: ToastState.error,
                    message: 'unable to fetch authorization info for provider'
                });
            });
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
