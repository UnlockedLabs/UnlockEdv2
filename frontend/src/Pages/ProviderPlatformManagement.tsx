import ProviderCard from '@/Components/ProviderCard';
import AddProviderForm from '@/Components/forms/AddProviderForm';
import EditProviderForm from '@/Components/forms/EditProviderForm';
import { AxiosError } from 'axios';
import Modal from '@/Components/Modal';
import {
    ModalType,
    OidcClient,
    ProviderPlatform,
    ServerResponse,
    ToastState,
    ProviderPlatformState,
    FeatureAccess,
    ProviderResponse
} from '@/common';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState, useEffect } from 'react';
import useSWR from 'swr';
import RegisterOidcClientForm from '@/Components/forms/RegisterOidcClientForm';
import NewOidcClientNotification from '@/Components/NewOidcClientNotification';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { hasFeature, useAuth } from '@/useAuth';

export default function ProviderPlatformManagement() {
    const { user } = useAuth();
    if (!user || !hasFeature(user, FeatureAccess.ProviderAccess)) {
        return null;
    }
    const addProviderModal = useRef<HTMLDialogElement>(null);
    const editProviderModal = useRef<HTMLDialogElement>(null);
    const [editProvider, setEditProvider] = useState<
        ProviderPlatform | undefined
    >();
    const openOidcClientModal = useRef<HTMLDialogElement>(null);
    const openOidcRegistrationModal = useRef<HTMLDialogElement>(null);
    const [oidcClient, setOidcClient] = useState<OidcClient | undefined>();
    const { toaster } = useToast();
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
        useEffect(() => {
            const queryParams = new URLSearchParams(window.location.search);
            const status = queryParams.get('status');
            const message = queryParams.get('message');
    
            if (status && message) {
                if (status === 'success') {
                    toaster(message, ToastState.success);
                } else if (status === 'error') {
                    toaster(message, ToastState.error);
                }
    
                // Clear the query parameters to avoid repeated toasts
                const url = new URL(window.location.href);
                url.searchParams.delete('status');
                url.searchParams.delete('message');
                window.history.replaceState({}, document.title, url.toString());
            }
        }, [toaster]);
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
            toaster(message, state);
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
            toaster('OIDC client registered successfully.', state);
        } else if (!response && state === ToastState.error) {
            toaster('Failed to register OIDC client.', state);
        } else {
            setOidcClient(response.data as OidcClient);
            openOidcRegistrationModal.current?.showModal();
        }
        void mutate();
        if (response && state) {
            toaster(response.message, state);
        }
    };
    const handleToggleArchiveProvider = (provider: ProviderPlatform) => {
        const state =
            provider.state === ProviderPlatformState.ARCHIVED
                ? 'enabled'
                : 'archived';
        API.patch<ProviderResponse, { state: string }>(
            `provider-platforms/${provider.id}`,
            {
                state: state
            }
        )
            .then((resp) => {
                if (resp.success) {
                    const providerData =resp.data as ProviderResponse;
                    if (providerData.oauth2Url) {
                        window.location.href = providerData.oauth2Url;
                        return;
                    }
                    toaster(
                        `Provider platform ${provider.name} has been ${state}.`,
                        ToastState.success
                    );
                    void mutate();
                }
            })
            .catch(() => {
                toaster('Unable to toggle provider state', ToastState.error);
            });
    };
    const refreshToken = (provider: ProviderPlatform) => {
        const errorMsg = 'Unable to refresh token for provider for ' + provider.name;
        API.get<ProviderResponse>(`provider-platforms/${provider.id}/refresh`)
            .then((resp) => {
                if (resp.success) {
                    const providerData =resp.data as ProviderResponse;
                    if (providerData.oauth2Url) {
                        window.location.href = providerData.oauth2Url;
                    }
                }else{
                    toaster(errorMsg, ToastState.error);
                }
            })
            .catch(() => {
                toaster(errorMsg, ToastState.error);
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
                toaster(
                    'unable to fetch authorization info for provider',
                    ToastState.error
                );
            });
    };

    return (
        <div>
            <div className="px-8 py-4">
                <h1>Learning Platforms</h1>
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
                        Add Learning Platform
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
                                        refreshToken={refreshToken}
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
                                <td>No learning platforms</td>
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
        </div>
    );
}
