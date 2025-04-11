import ProviderCard from '@/Components/ProviderCard';
import {
    OidcClient,
    ProviderPlatform,
    ToastState,
    ProviderPlatformState,
    FeatureAccess,
    ProviderResponse,
    ServerResponseMany
} from '@/common';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRef, useState, useEffect } from 'react';
import useSWR from 'swr';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { hasFeature, useAuth } from '@/useAuth';
import {
    AddProviderModal,
    closeModal,
    EditProviderModal,
    RegisterOIDCClientModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';

export default function ProviderPlatformManagement() {
    const { user } = useAuth();
    if (!user || !hasFeature(user, FeatureAccess.ProviderAccess)) {
        return null;
    }
    const addProviderModal = useRef<HTMLDialogElement>(null);
    const editProviderModal = useRef<HTMLDialogElement>(null);
    const [editProvider, setEditProvider] = useState<ProviderPlatform | null>(
        null
    );
    const openOidcClientModal = useRef<HTMLDialogElement>(null);
    const openOidcRegistrationModal = useRef<HTMLDialogElement>(null);
    const [oidcClient, setOidcClient] = useState<OidcClient | null>(null);
    const { toaster } = useToast();
    const {
        data: providers,
        mutate,
        error,
        isLoading
    } = useSWR<ServerResponseMany<ProviderPlatform>, Error>(
        `/api/provider-platforms`
    );
    const providerData = providers?.data ?? [];
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

    function openEditProvider(provider: ProviderPlatform) {
        setEditProvider(provider);
        showModal(editProviderModal);
    }

    const registerOidcClient = (prov: ProviderPlatform) => {
        showModal(openOidcClientModal);
        setEditProvider(prov);
    };

    const onRegisterOidcClientClose = (oidcClient: OidcClient) => {
        setEditProvider(null);
        setOidcClient(oidcClient);
        showModal(openOidcRegistrationModal);
    };

    const handleToggleArchiveProvider = async (provider: ProviderPlatform) => {
        const state =
            provider.state === ProviderPlatformState.ARCHIVED
                ? 'enabled'
                : 'archived';
        const resp = await API.patch<ProviderResponse, { state: string }>(
            `provider-platforms/${provider.id}`,
            { state: state }
        );
        if (resp.success) {
            const providerData = resp.data as ProviderResponse;
            if (providerData.oauth2Url) {
                window.location.href = providerData.oauth2Url;
                return;
            }
            toaster(
                `Provider platform ${provider.name} has been ${state}`,
                ToastState.success
            );
            void mutate();
        } else {
            toaster('Unable to toggle provider state', ToastState.error);
        }
    };

    const refreshToken = (provider: ProviderPlatform) => {
        const errorMsg =
            'Unable to refresh token for provider for ' + provider.name;
        API.get<ProviderResponse>(`provider-platforms/${provider.id}/refresh`)
            .then((resp) => {
                if (resp.success) {
                    const providerData = resp.data as ProviderResponse;
                    if (providerData.oauth2Url) {
                        window.location.href = providerData.oauth2Url;
                    }
                } else {
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
                    showModal(openOidcRegistrationModal);
                }
            })
            .catch(() => {
                toaster(
                    'Unable to fetch authorization info for provider',
                    ToastState.error
                );
            });
    };

    return (
        <div>
            <div className="px-5 py-4">
                <div className="flex flex-row justify-between">
                    <div>
                        {/* TO DO: this is where SEARCH and SORT will go */}
                    </div>
                    <button
                        className="button"
                        onClick={() => {
                            showModal(addProviderModal);
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
                                            void handleToggleArchiveProvider(
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
            <AddProviderModal mutate={mutate} ref={addProviderModal} />
            <EditProviderModal
                mutate={mutate}
                target={editProvider ?? undefined}
                ref={editProviderModal}
            />
            <RegisterOIDCClientModal
                mutate={mutate}
                target={editProvider ?? undefined}
                onSuccess={onRegisterOidcClientClose}
                ref={openOidcClientModal}
            />
            <TextOnlyModal
                ref={openOidcRegistrationModal}
                type={TextModalType.Information}
                title={'OIDC Client Registration'}
                text={
                    'The provider platform has successfully been registered. Please make sure to save the following information.'
                }
                onSubmit={() => {}} //eslint-disable-line
                onClose={() => {
                    closeModal(openOidcRegistrationModal);
                    setOidcClient(null);
                }}
            >
                <p className="body flex flex-row justify-between">
                    <span className="font-bold">Client ID: </span>
                    <span className="text-warning">
                        {oidcClient?.client_id}
                    </span>
                </p>
                <p className="body flex flex-row justify-between">
                    <span className="font-bold">Client Secret: </span>
                    <span className="text-warning">
                        {oidcClient?.client_secret}
                    </span>
                </p>
                <p className="body flex flex-row justify-between">
                    <span className="font-bold">Authorization Endpoint: </span>
                    <span className="text-warning">{oidcClient?.auth_url}</span>
                </p>
                <p className="body flex flex-row justify-between">
                    <span className="font-bold">Token Endpoint: </span>
                    <span className="text-warning">
                        {oidcClient?.token_url}
                    </span>
                </p>
                <p className="body flex flex-row justify-between">
                    <span className="font-bold">Scopes: </span>
                    <span className="text-warning">{oidcClient?.scope}</span>
                </p>
            </TextOnlyModal>
        </div>
    );
}
