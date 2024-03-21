import PageNav from "@/Components/PageNav";
import ProviderCard from "@/Components/ProviderCard";
import SecondaryButton from "@/Components/SecondaryButton";
import AddProviderForm from "@/Components/forms/AddProviderForm";
import EditProviderForm from "@/Components/forms/EditProviderForm";
import ProviderForm from "@/Components/forms/ProviderForm";
import AddModal from "@/Components/modals/AddModal";
import EditModal from "@/Components/modals/EditModal";
import Modal from "@/Components/modals/Modal";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { ProviderPlatform } from "@/common";
import { PageProps } from "@/types";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

export default function ProviderPlatformManagement({ auth }: PageProps) {
    const addProviderModal = useRef<null | HTMLDialogElement>(null);
    const editProviderModal = useRef<null | HTMLDialogElement>(null);
    const [editProvider, setEditProvider] = useState<ProviderPlatform | null>(
        null,
    );

    const {
        data: providers,
        mutate,
        error,
        isLoading,
    } = useSWR(`/api/v1/provider-platforms`);

    providers?.data.sort(function (
        providerA: ProviderPlatform,
        providerB: ProviderPlatform,
    ) {
        if (providerA.state === "enabled" && providerB.state !== "enabled") {
            return -1; // providerA comes before providerB
        } else if (
            providerA.state !== "enabled" &&
            providerB.state === "enabled"
        ) {
            return 1; // providerB comes before providerA
        } else if (
            providerA.state === "archived" &&
            providerB.state !== "archived"
        ) {
            return 1; // providerA comes after providerB
        } else if (
            providerA.state !== "archived" &&
            providerB.state === "archived"
        ) {
            return -1; // providerB comes after providerA
        } else {
            return 0; // if states are the same or not 'enabled' or 'archived', maintain current order
        }
    });

    function openEditProvider(provider: ProviderPlatform) {
        setEditProvider(provider), editProviderModal.current?.showModal();
    }

    function updateProvider() {
        mutate();
        editProviderModal.current?.close(), setEditProvider(null);
    }

    return (
        <AuthenticatedLayout
            user={auth.user}
            title="Provider Platform Management"
        >
            <PageNav
                user={auth.user}
                path={["Settings", "Provider Platform Management"]}
            />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex justify-end">
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                            addProviderModal.current?.showModal();
                        }}
                    >
                        <PlusCircleIcon className="h-4 text-base-100" />
                        <span className="text-base-100">Add Provider</span>
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-5">
                    {!isLoading && !error ? (
                        providers.data.map((provider: ProviderPlatform) => {
                            return (
                                <ProviderCard
                                    provider={provider}
                                    openEditProvider={openEditProvider}
                                    key={provider.id}
                                />
                            );
                        })
                    ) : (
                        <div>No platform providers to show.</div>
                    )}
                </div>
            </div>
            {/* Modals */}
            <AddModal
                item="Provider"
                addForm={
                    <ProviderForm
                        onSuccess={() => {
                            mutate(), addProviderModal.current?.close();
                        }}
                        provider={null}
                    />
                }
                ref={addProviderModal}
            />
            <EditModal
                item="Provider"
                editForm={
                    editProvider ? (
                        <ProviderForm
                            onSuccess={() => updateProvider()}
                            provider={editProvider}
                        />
                    ) : (
                        <></>
                    )
                }
                onClose={() => setEditProvider(null)}
                ref={editProviderModal}
            />
        </AuthenticatedLayout>
    );
}
