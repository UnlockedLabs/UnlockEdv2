import PageNav from "@/Components/PageNav";
import ProviderCard from "@/Components/ProviderCard";
import AddProviderForm from "@/Components/forms/AddProviderForm";
import EditProviderForm from "@/Components/forms/EditProviderForm";
import Modal from "@/Components/Modal";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { OidcClient, ProviderPlatform, ServerResponse } from "@/common";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useRef, useState } from "react";
import useSWR from "swr";
import Toast, { ToastState } from "@/Components/Toast";
import { useAuth } from "../AuthContext";
import RegisterOidcClientForm from "@/Components/forms/RegisterOidcClientForm";
import NewOidcClientNotification from "@/Components/NewOidcClientNotification";
import axios from "axios";

interface ToastProps {
  state: ToastState;
  message: string;
}

export default function ProviderPlatformManagement() {
  const { user } = useAuth();
  const addProviderModal = useRef<null | HTMLDialogElement>(null);
  const editProviderModal = useRef<null | HTMLDialogElement>(null);
  const [editProvider, setEditProvider] = useState<ProviderPlatform | null>(
    null
  );
  const openOidcClientModal = useRef<null | HTMLDialogElement>(null);
  const openOidcRegistrationModal = useRef<null | HTMLDialogElement>(null);
  const [oidcClient, setOidcClient] = useState<OidcClient | null>(null);
  const [toast, setToast] = useState<ToastProps>({
    state: ToastState.null,
    message: "",
  });

  const {
    data: providers,
    mutate,
    error,
    isLoading,
  } = useSWR(`/api/provider-platforms`);

  // TO DO: SORT THIS IN THE BACKEND AND RETURN SORTED
  providers?.data.sort(function (
    providerA: ProviderPlatform,
    providerB: ProviderPlatform
  ) {
    if (providerA.state === "enabled" && providerB.state !== "enabled") {
      return -1;
    } else if (providerA.state !== "enabled" && providerB.state === "enabled") {
      return 1;
    } else if (
      providerA.state === "archived" &&
      providerB.state !== "archived"
    ) {
      return 1;
    } else if (
      providerA.state !== "archived" &&
      providerB.state === "archived"
    ) {
      return -1;
    } else {
      return 0;
    }
  });

  function resetModal() {
    setTimeout(() => {
      setEditProvider(null);
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
        message: message,
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
    setEditProvider(null);
    if (!response && state == ToastState.success) {
      setToast({
        state: state,
        message: "OIDC client registered successfully.",
      });
    } else if (!response && state == ToastState.error) {
      setToast({
        state: state,
        message: "Failed to register OIDC client.",
      });
    } else {
      console.log(response.data[0]);
      setOidcClient(response.data[0] as OidcClient);
      openOidcRegistrationModal.current?.showModal();
    }
    mutate();
    state &&
      response &&
      setToast({
        state: state,
        message: response.message,
      });
  };

  const showAuthorizationInfo = async (provider: ProviderPlatform) => {
    const resp = await axios(`/api/oidc/clients/${provider.oidc_id}`);
    if (resp.data) {
      setOidcClient(resp.data.data[0] as OidcClient);
      openOidcRegistrationModal.current?.showModal();
      return;
    }
  };

  return (
    <AuthenticatedLayout title="Provider Platform Management">
      <PageNav
        user={user}
        path={["Settings", "Provider Platform Management"]}
      />
      <div className="px-8 py-4">
        <h1>Provider Platforms</h1>
        <div className="flex flex-row justify-between">
          <div>{/* TO DO: this is where SEARCH and SORT will go */}</div>
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
              providers.data.map((provider: ProviderPlatform) => {
                return (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    openEditProvider={openEditProvider}
                    oidcClient={() => registerOidcClient(provider)}
                    showAuthorizationInfo={() =>
                      showAuthorizationInfo(provider)
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
        type="Add"
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
        type="Edit"
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
        type="Register"
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
        type="Register"
        item="OIDC Client"
        form={
          oidcClient ? (
            <NewOidcClientNotification
              client={oidcClient}
              onClose={() => openOidcRegistrationModal.current?.close()}
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
          reset={() => setToast({ state: ToastState.null, message: "" })}
        />
      )}
    </AuthenticatedLayout>
  );
}
