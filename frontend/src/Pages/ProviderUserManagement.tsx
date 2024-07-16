import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AuthenticatedLayout from "../Layouts/AuthenticatedLayout";
import { useParams } from "react-router-dom";
import {
  PaginatedResponse,
  PaginationMeta,
  ProviderPlatform,
  ProviderUser,
  UserImports,
} from "../common";
import PageNav from "../Components/PageNav";
import Toast, { ToastState } from "../Components/Toast";
import Modal, { ModalType } from "../Components/Modal";
import { useAuth } from "../AuthContext";
import MapUserForm from "@/Components/forms/MapUserForm";
import PrimaryButton from "@/Components/PrimaryButton";
import ShowImportedUsers from "@/Components/forms/ShowImportedUsers";
import Pagination from "@/Components/Pagination";
import useSWR from "swr";

export default function ProviderUserManagement() {
  const auth = useAuth();
  const mapUserModal = useRef<null | HTMLDialogElement>(null);
  const importedUsersModal = useRef<null | HTMLDialogElement>(null);
  const [displayToast, setDisplayToast] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [usersToImport, setUsersToImport] = useState<ProviderUser[]>([]);
  const [userToMap, setUserToMap] = useState<null | ProviderUser>(null);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const { providerId } = useParams();
  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    per_page: 10,
    total: 0,
    last_page: 0,
  });
  const [provider, setProvider] = useState<ProviderPlatform | null>(null);
  const [importedUsers, setImportedUsers] = useState<UserImports[]>([]);
  const [cache, setCache] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const [toast, setToast] = useState({
    state: ToastState.null,
    message: "",
    reset: () => {},
  });
  const { data, mutate } = useSWR<PaginatedResponse<ProviderUser>>(
    `/api/actions/provider-platforms/${providerId}/get-users?page=${currentPage}&per_page=${perPage}&clear_cache=${cache}`,
  );

  const changePage = (page: number) => {
    setCurrentPage(page);
  };

  const handleChangeUsersPerPage = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to the first page when changing per page
  };

  const handleRefetch = () => {
    setCache(true);
    mutate();
  };

  const showToast = (message: string, state: ToastState) => {
    setToast({
      state,
      message,
      reset: () => {
        setToast({
          state: ToastState.success,
          message: "",
          reset: () => {
            setDisplayToast(false);
          },
        });
      },
    });
    setDisplayToast(true);
  };

  async function handleImportAllPrograms() {
    try {
      let resp = await axios.post(
        `/api/actions/provider-platforms/${providerId}/import-programs`,
      );
      if (resp.status != 200) {
        showToast(
          "error importing all or some programs, please try again later",
          ToastState.error,
        );
        return;
      } else {
        showToast(
          "Programs imported successfully from provider",
          ToastState.success,
        );
        return;
      }
    } catch (err: any) {
      showToast(
        "error importing all or some programs, please try again later",
        ToastState.error,
      );
      return;
    }
  }

  async function handleImportAllUsers() {
    let ans = prompt(
      "Are you sure you want to import all users from this provider? (yes/no)",
    );
    if (ans != "yes") {
      return;
    }
    try {
      let res = await axios.post(
        `/api/actions/provider-platforms/${providerId}/import-users`,
      );
      if (res.status === 200) {
        showToast(
          "Users imported successfully, please check for accounts not created",
          ToastState.success,
        );
        window.location.reload();
      }
    } catch (error: any) {
      setError(true);
      showToast("Failed to import users", ToastState.error);
    }
  }

  async function handleImportSelectedUsers() {
    try {
      let res = await axios.post(
        `/api/provider-platforms/${providerId}/users/import`,
        { users: usersToImport },
      );
      if (res.status === 200) {
        showToast(res.data.message, ToastState.success);
        console.log(res.data.data);
        setImportedUsers(res.data.data);
        importedUsersModal.current?.showModal();
        setUsersToImport([]);
        mutate();
        return;
      }
    } catch (err: any) {
      setUsersToImport([]);
      showToast(
        "error importing users, please check accounts",
        ToastState.error,
      );
    }
  }

  function handleSubmitMapUser(msg: string, toastState: ToastState) {
    showToast(msg, toastState);
    mapUserModal.current?.close();
  }

  function handleCloseImportedUsers() {
    importedUsersModal.current?.close();
    setImportedUsers([]);
    return;
  }

  function handleCloseMapUser() {
    mapUserModal.current?.close();
    setUserToMap(null);
  }

  async function handleMapUser(user: ProviderUser) {
    setUserToMap(user);
    mapUserModal.current?.showModal();
  }

  function handleAddImportUser(user: ProviderUser) {
    if (usersToImport.includes(user)) {
      setUsersToImport(usersToImport.filter((u) => u !== user));
    } else {
      setUsersToImport([...usersToImport, user]);
    }
  }

  useEffect(() => {
    if (data) {
      setMeta(data.meta);
      setCache(false);
    }
  }, [data]);

  useEffect(() => {
    const getData = async () => {
      try {
        const res = await axios.get(`/api/provider-platforms/${providerId}`);
        if (res.status === 200) {
          setProvider(res.data.data);
          setIsLoading(false);
        }
      } catch (error: any) {
        showToast("Failed to fetch provider users", ToastState.error);
      }
    };
    getData();
  }, [providerId]);

  return (
    <AuthenticatedLayout title="Users">
      <PageNav
        user={auth.user!}
        path={["Provider Platforms", "Provider User Management"]}
      />
      <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4">
        <div className="flex justify-between">
          <input
            type="text"
            placeholder="Search..."
            className="input input-bordered w-full max-w-xs input-sm"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex justify-between">
          <button className="btn btn-sm btn-outline" onClick={handleRefetch}>
            Refresh
          </button>
          <PrimaryButton
            onClick={() => handleImportAllUsers()}
            disabled={!provider}
          >
            Import All Users
          </PrimaryButton>
          <PrimaryButton
            onClick={() => handleImportAllPrograms()}
            disabled={!provider}
          >
            Import Programs from Provider
          </PrimaryButton>
          <PrimaryButton
            onClick={() => handleImportSelectedUsers()}
            disabled={usersToImport.length === 0}
          >
            Import Selected Users
          </PrimaryButton>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-auto table-xs w-full">
            <thead>
              <tr className="border-gray-600 table-row">
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Import</th>
                <th>Associate</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading &&
                !error &&
                data &&
                data.data.map((user: any) => (
                  <tr
                    key={user.external_user_id}
                    className="border-gray-600 table-row"
                  >
                    <td>{user.name_first + " " + user.name_last}</td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      <div
                        className="tooltip"
                        data-tip="import user into platform"
                      >
                        <div className="form-control">
                          <label className="label cursor-pointer gap-2">
                            Import User
                            <input
                              type="checkbox"
                              className="checkbox"
                              onChange={() => handleAddImportUser(user)}
                              checked={usersToImport.includes(user)}
                            />
                          </label>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        className="tooltip"
                        data-tip="Associate user with existing account"
                      >
                        <button
                          onClick={() => handleMapUser(user)}
                          className="btn btn-xs btn-primary"
                        >
                          Map User
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col justify-center">
          <Pagination meta={!isLoading && meta} setPage={changePage} />
          <div className="flex-col-1 align-middle">
            per page:
            <br />
            {!isLoading && data && (
              <select
                className="select select-none select-sm select-bordered"
                value={perPage}
                onChange={handleChangeUsersPerPage}
              >
                {[10, 15, 20, 30, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        {error && (
          <span className="text-center text-error">Failed to load users.</span>
        )}
        {!isLoading && !error && data && data.meta.total === 0 && (
          <span className="text-center text-warning">No results</span>
        )}
      </div>
      {provider && (
        <Modal
          ref={mapUserModal}
          type={ModalType.Associate}
          item="User"
          form={
            <MapUserForm
              onSubmit={handleSubmitMapUser}
              externalUser={userToMap}
              onCancel={handleCloseMapUser}
              providerId={parseInt(providerId)}
            />
          }
        />
      )}
      <Modal
        ref={importedUsersModal}
        type={ModalType.View}
        item="Imported Users"
        form={
          <ShowImportedUsers
            users={importedUsers}
            onExit={handleCloseImportedUsers}
          />
        }
      />
      {displayToast && <Toast {...toast} />}
    </AuthenticatedLayout>
  );
}
