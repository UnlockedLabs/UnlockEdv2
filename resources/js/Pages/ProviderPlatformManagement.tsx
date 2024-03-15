import PageNav from "@/Components/PageNav";
import SecondaryButton from "@/Components/SecondaryButton";
import AddProviderForm from "@/Components/forms/AddProviderForm";
import EditProviderForm from "@/Components/forms/EditProviderForm";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { ProviderPlatform } from "@/common";
import { PageProps } from "@/types";
import { DocumentCheckIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
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

    useEffect(() => {
        console.log(providers);
    }, [providers]);

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

    function ProviderCard({ provider }: { provider: ProviderPlatform }) {
        let cardImg = provider.icon_url;
        if (cardImg == null) {
            cardImg = "/" + provider.type + ".jpg";
        }
        return (
            <div className="">
                <div className="card card-compact bg-base-100 shadow-xl h-full">
                    <figure className="h-1/2">
                        <img src={cardImg} alt="" className="object-contain" />
                    </figure>
                    <div
                        className={`inline-flex items-center px-4 py-2 dark:bg-gray-800 font-semibold text-xs text-white dark:text-gray-800 uppercase tracking-widest
                                ${
                                    provider.state == "archived"
                                        ? "bg-accent"
                                        : provider.state == "disabled"
                                          ? "bg-neutral"
                                          : "bg-primary"
                                }`}
                    >
                        <span className="mx-auto">{provider.state}</span>
                    </div>
                    <div className="card-body flex flex-col gap-2 content-between">
                        <div className="flex flex-row justify-between">
                            <h2 className="card-title">{provider.name}</h2>
                            <SecondaryButton
                                className="gap-2"
                                onClick={() => {
                                    setEditProvider(provider),
                                        editProviderModal.current?.showModal();
                                }}
                            >
                                <PencilSquareIcon className="w-4" />
                            </SecondaryButton>
                        </div>
                        <p>
                            <span className="font-bold">Description: </span>
                            {provider.description}
                        </p>
                        <p>
                            <span className="font-bold">Type: </span>
                            {provider.type}
                        </p>
                    </div>
                </div>
            </div>
        );
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
            <dialog ref={addProviderModal} className="modal">
                <div className="modal-box">
                    <div className="flex flex-col">
                        <span className="text-3xl font-semibold pb-6 text-neutral">
                            Add Provider Platform
                        </span>
                        <AddProviderForm
                            onSuccess={() => {
                                mutate();
                                addProviderModal.current?.close();
                            }}
                        />
                    </div>
                </div>
            </dialog>
            <dialog ref={editProviderModal} className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button
                            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={() => {
                                setEditProvider(null);
                            }}
                        >
                            ✕
                        </button>
                    </form>
                    <div className="flex flex-col">
                        <span className="text-3xl font-semibold pb-6 text-neutral">
                            Edit Provider Platform
                        </span>
                        {editProvider ? (
                            <EditProviderForm
                                onSuccess={() => {
                                    mutate();
                                    editProviderModal.current?.close(),
                                        setEditProvider(null);
                                }}
                                provider={editProvider}
                            />
                        ) : (
                            <div>
                                Could not load form. Please try again later.
                            </div>
                        )}
                    </div>
                </div>
            </dialog>
        </AuthenticatedLayout>
    );
}
